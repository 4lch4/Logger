import { PostHog } from 'posthog-node'

import type { AttributeValue, ExceptionReporter, Resource } from './types.js'

/** The part of `posthog-node`'s client this package uses. Tests pass a fake. */
export interface PostHogClientLike {
  captureException(
    error: unknown,
    distinctId?: string,
    additionalProperties?: Record<string | number, any>
  ): void
  flush(): Promise<void>
  shutdown(shutdownTimeoutMs?: number): Promise<void>
}

/** The options of {@link createExceptionReporter}. */
export interface ExceptionReporterOptions {
  /** The project key (`phc_…`). */
  apiKey: string
  /** PostHog's host, such as `https://us.i.posthog.com`. */
  host: string
  /** The resource attributes to put on every exception. */
  resource: Resource
  /** Defaults to a new `posthog-node` client. */
  client?: PostHogClientLike
}

/** The `distinct_id` used when nothing names the service. */
export const UNKNOWN_SERVICE = 'unknown_service'

/** A client that accepts everything and sends nothing, for when `posthog-node` can't be set up. */
const SILENT_CLIENT: PostHogClientLike = {
  captureException() {
    // Nothing to do.
  },
  flush() {
    return Promise.resolve()
  },
  shutdown() {
    return Promise.resolve()
  },
}

/**
 * Creates the `posthog-node` client this package uses. It's set up to send exceptions and nothing
 * else: no exception autocapture (this package has its own handlers) and no feature-flag loading
 * or polling. The client keeps its queue in memory, and its timers don't hold the process open.
 * When the client can't be created at all, a silent one takes its place, so a bad configuration
 * can't stop the app.
 */
function createClient(options: ExceptionReporterOptions): PostHogClientLike {
  try {
    return new PostHog(options.apiKey, {
      host: options.host,
      enableExceptionAutocapture: false,
      preloadFeatureFlags: false,
      featureFlagsPollingInterval: null,
    })
  } catch {
    return SILENT_CLIENT
  }
}

/**
 * Runs a task and resolves when it has settled or when the time limit has passed, whichever comes
 * first. Neither a throw nor a rejection escapes.
 *
 * @param task The work to wait for.
 * @param timeoutMs The longest to wait.
 * @param keepAlive Whether the timer keeps the process alive until the task settles. Off by
 *   default, so waiting never holds a process open. The fatal-error handlers turn it on: a
 *   runtime ends a process whose event loop is empty, and without this it could end before the
 *   task has flushed anything.
 * @returns A promise that always resolves.
 */
function settleWithin(
  task: () => Promise<void> | void,
  timeoutMs: number,
  keepAlive = false
): Promise<void> {
  return new Promise<void>(resolve => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const finish = (): void => {
      if (settled) return

      settled = true
      if (timer !== undefined) clearTimeout(timer)
      resolve()
    }

    timer = setTimeout(finish, Math.max(0, timeoutMs))
    if (!keepAlive) timer.unref?.()

    let result: unknown

    try {
      result = task()
    } catch {
      finish()
      return
    }

    Promise.resolve(result).then(finish, finish)
  })
}

/**
 * Creates a reporter that sends exceptions to PostHog's error tracking. Every method is safe to
 * call: none of them throws, rejects, or waits longer than it was told to, whatever the client
 * does.
 *
 * @param options The project key, host, resource attributes and, for tests, a client to use.
 * @returns A reporter that queues exceptions and can flush or shut them down.
 */
export function createExceptionReporter(options: ExceptionReporterOptions): ExceptionReporter {
  const client = options.client ?? createClient(options)
  const service = options.resource['service.name']
  const distinctId = typeof service === 'string' && service ? service : UNKNOWN_SERVICE

  let stopped = false
  let shutdownPromise: Promise<void> | undefined

  return {
    capture(error, attributes) {
      if (stopped) return

      const properties: Record<string, AttributeValue | boolean> = {
        ...options.resource,
        ...attributes,
        $process_person_profile: false,
      }

      try {
        const result: unknown = client.captureException(error, distinctId, properties)

        // A client that returns a rejecting promise instead of throwing must not leave it
        // unhandled, or the app would crash on an exception it never saw.
        Promise.resolve(result).catch(() => {})
      } catch {
        // Recording an exception never fails the app.
      }
    },

    async flush() {
      try {
        await client.flush()
      } catch {
        // Sending is best effort.
      }
    },

    shutdown(timeoutMs) {
      if (shutdownPromise !== undefined) return shutdownPromise

      stopped = true
      shutdownPromise = settleWithin(() => client.shutdown(timeoutMs), timeoutMs)

      return shutdownPromise
    },
  }
}

/** The part of `process` the handlers use. Tests pass a fake built on `EventEmitter`. */
export interface ProcessLike {
  on(event: string, listener: (...args: any[]) => void): unknown
  removeListener(event: string, listener: (...args: any[]) => void): unknown
  listeners(event: string): Function[]
  exit(code?: number): unknown
}

/** The kind of fatal error being reported: an uncaught exception or an unhandled rejection. */
export type FatalKind = 'uncaughtException' | 'unhandledRejection'

/** The options of {@link installProcessHandlers}. */
export interface ProcessHandlersOptions {
  /** Called once with the fatal error. The caller logs it, captures it and flushes inside this. */
  onFatal: (error: unknown, kind: FatalKind) => Promise<void> | void
  /** The longest to wait for `onFatal`. Defaults to 6_000. */
  timeoutMs?: number
  /** Defaults to the global `process`. */
  process?: ProcessLike
}

/** What an installed pair of handlers remembers for its process. */
interface HandlersState {
  /** Removes the handlers. Safe to call more than once. */
  remove: () => void
}

/** The handlers installed on each process, so a second install can reuse the first. */
const installed = new WeakMap<ProcessLike, HandlersState>()

/**
 * Installs handlers for uncaught exceptions and unhandled rejections. Each one records the fatal
 * error through `onFatal`, waits at most `timeoutMs` for that, and then lets the process end the
 * way it would have without this library: with code 1 when the app has no listener of its own,
 * and not at all when it does.
 *
 * Calling it again for the same process object while the handlers are installed does nothing and
 * returns the first call's remove function. It never throws.
 *
 * @param options What to call with the fatal error and how long to wait for it.
 * @returns A function that removes both handlers. Calling it more than once is harmless.
 */
export function installProcessHandlers(options: ProcessHandlersOptions): () => void {
  const proc = options.process ?? process
  const existing = installed.get(proc)

  if (existing !== undefined) return existing.remove

  const timeoutMs = options.timeoutMs ?? 6_000

  /** Whether a fatal error is being handled right now. */
  let handling = false

  /** Whether the remove function has run, so calling it again changes nothing. */
  let removed = false

  /** The app's own listeners for an event, without this module's. */
  const otherListeners = (event: string): Function[] => {
    try {
      return proc
        .listeners(event)
        .filter(listener => listener !== onUncaughtException && listener !== onUnhandledRejection)
    } catch {
      return []
    }
  }

  /** Ends the process quietly. A process is meant to end after this, so the mark stays set. */
  const exit = (code: number): void => {
    try {
      proc.exit(code)
    } catch {
      // A process that can't exit still gets no exception from here.
    }
  }

  /**
   * Tells the runtime which code to use should it end before {@link exit} runs, so the code is
   * right even then.
   */
  const noteExitCode = (code: number): void => {
    try {
      if (proc === process) process.exitCode = code
    } catch {
      // A process without an exit code still ends normally.
    }
  }

  /** Calls one of the app's listeners for an unhandled rejection, ignoring what it throws. */
  const callListener = (listener: Function, reason: unknown): void => {
    try {
      const result: unknown = listener(reason, 'unhandledRejection')

      // A listener that returns a rejecting promise must not become a second unhandled rejection.
      Promise.resolve(result).catch(() => {})
    } catch {
      // A listener the app wrote is the app's own problem.
    }
  }

  /** Handles an uncaught exception, then exits unless the app has its own listener. */
  const onUncaughtException = async (error: unknown): Promise<void> => {
    if (handling) return

    handling = true

    try {
      const hasOwnListener = otherListeners('uncaughtException').length > 0

      if (!hasOwnListener) noteExitCode(1)

      await settleWithin(() => options.onFatal(error, 'uncaughtException'), timeoutMs, true)

      // Without a listener of its own, the runtime would have exited with code 1.
      if (!hasOwnListener) {
        exit(1)
        return
      }
    } catch {
      // Recording a fatal error never fails on its own.
    }

    handling = false
  }

  /** Handles an unhandled rejection the way Node would without this library. */
  const onUnhandledRejection = async (reason: unknown): Promise<void> => {
    if (handling) return

    handling = true

    try {
      const rejectionListeners = otherListeners('unhandledRejection')
      const exceptionListeners = otherListeners('uncaughtException')

      if (rejectionListeners.length === 0 && exceptionListeners.length === 0) noteExitCode(1)

      await settleWithin(() => options.onFatal(reason, 'unhandledRejection'), timeoutMs, true)

      if (rejectionListeners.length > 0) {
        handling = false
        return
      }

      // Node hands an unhandled rejection to the uncaughtException listeners, then ends.
      if (exceptionListeners.length > 0) {
        for (const listener of exceptionListeners) callListener(listener, reason)

        handling = false
        return
      }

      exit(1)
      return
    } catch {
      // Recording a fatal error never fails on its own.
    }

    handling = false
  }

  const state: HandlersState = {
    remove() {
      if (removed) return

      removed = true
      installed.delete(proc)

      try {
        proc.removeListener('uncaughtException', onUncaughtException)
        proc.removeListener('unhandledRejection', onUnhandledRejection)
      } catch {
        // Removing handlers never fails the app.
      }
    },
  }

  try {
    proc.on('uncaughtException', onUncaughtException)
    proc.on('unhandledRejection', onUnhandledRejection)
  } catch {
    // A process that can't take listeners gets none, and the app carries on.
  }

  installed.set(proc, state)

  return state.remove
}
