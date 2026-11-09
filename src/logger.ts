import { flattenAttributes } from './attributes.js'
import { resolveConfig } from './config.js'
import { createExceptionReporter, installProcessHandlers } from './exceptions.js'
import type { ProcessLike } from './exceptions.js'
import { createOtlpExporter } from './otlp.js'
import { createStdoutWriter } from './stdout.js'
import { LEVELS } from './types.js'
import type {
  Attributes,
  Config,
  ExceptionReporter,
  ExporterStatus,
  Level,
  LogExporter,
  Logger,
  LoggerOptions,
  LogRecord,
  LooseAttributes,
  Resource,
} from './types.js'

/** How long `shutdown()` and the fatal-error handlers wait for sending to finish. */
export const SHUTDOWN_TIMEOUT_MS = 5_000

/** The pieces a logger is built from. Tests pass fakes; `createLogger` passes the real ones. */
export interface LoggerParts {
  config: Config
  /** Where stdout text goes. Defaults to `process.stdout.write`. */
  write?: (text: string) => void
  /** Sends Logs. Left out means nothing is sent. */
  exporter?: LogExporter
  /** Sends exceptions. Left out means nothing is sent. */
  reporter?: ExceptionReporter
  /** Installs the uncaught-exception and unhandled-rejection handlers. Defaults to false. */
  handleFatalErrors?: boolean
  /** The process the handlers are installed on. Defaults to the global `process`. */
  process?: ProcessLike
  /** Defaults to `SHUTDOWN_TIMEOUT_MS`. */
  shutdownTimeoutMs?: number
  /** The clock. Defaults to `() => new Date()`. */
  now?: () => Date
}

/** What every logger made by one `buildLogger` call shares with its children. */
interface SharedLogger {
  /** The configuration the logger was built from. */
  config: Config
  /** Writes one record to stdout. */
  write(record: LogRecord): void
  /** Sends Logs, when there is one. */
  exporter?: LogExporter
  /** Sends exceptions, when there is one. */
  reporter?: ExceptionReporter
  /** The clock records are timed with. */
  now: () => Date
  /** How long `shutdown()` waits for the exporter and the reporter. */
  timeoutMs: number
  /** Set by the first `shutdown()` call. While it's set, nothing is sent. */
  closed: boolean
  /** The first `shutdown()` call's promise, returned by every later call. */
  shutdownPromise?: Promise<void>
  /** Removes the fatal-error handlers this logger installed, when it installed any. */
  removeHandlers?: () => void
}

/** A configuration used when even resolving the options fails, so creation never throws. */
const FALLBACK_CONFIG: Config = { level: 'info', format: 'json', resource: {} }

/**
 * Tells whether a record at the given level should be written.
 *
 * @param configured The level the logger was configured with.
 * @param level The level of the record.
 * @returns `true` when the record is at or above the configured level.
 */
function isEnabled(configured: Level, level: Level): boolean {
  const limit = LEVELS.indexOf(configured)
  const index = LEVELS.indexOf(level)

  return limit === -1 || (index !== -1 && index <= limit)
}

/**
 * Reads the clock, falling back to the current time when it throws.
 *
 * @param now The clock.
 * @returns A date to time the record with.
 */
function readTime(now: () => Date): Date {
  try {
    const time = now()

    if (time instanceof Date) return time
  } catch {
    // A clock that throws is replaced by the real one.
  }

  return new Date()
}

/**
 * Turns a message into a string without ever throwing.
 *
 * @param message The value the caller gave as the message.
 * @returns The message as text.
 */
function toMessage(message: unknown): string {
  if (typeof message === 'string') return message

  try {
    return String(message)
  } catch {
    return 'The message could not be written.'
  }
}

/**
 * Copies attributes into one object, later sources winning over earlier ones. A source that isn't
 * an object is ignored, and a key whose value is `undefined` is left out.
 *
 * @param sources The attribute objects to merge, in order.
 * @returns A new object with every key that has a value.
 */
function mergeAttributes(...sources: readonly unknown[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {}

  for (const source of sources) {
    if (typeof source !== 'object' || source === null) continue

    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) {
        delete merged[key]
      } else {
        merged[key] = value
      }
    }
  }

  return merged
}

/**
 * Builds the attributes a child logger adds to every record: the parent's, then the child's own,
 * with an `error` key ignored because it belongs to a record and not to a logger.
 *
 * @param base The attributes the parent adds to every record.
 * @param attributes The attributes given to `child`.
 * @returns The attributes the child adds to every record.
 */
function childAttributes(base: LooseAttributes, attributes: unknown): Record<string, unknown> {
  const merged = mergeAttributes(base, attributes)

  delete merged.error

  return merged
}

/**
 * Copies a record's attributes without `error`, so an exception's properties never contain it.
 *
 * @param attributes The record's attributes.
 * @returns The other attributes.
 */
function attributesWithoutError(attributes: Attributes): LooseAttributes {
  const rest: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(attributes)) {
    if (key !== 'error') rest[key] = value
  }

  return rest
}

/**
 * Runs a task and resolves when it has settled, whether it succeeded, failed or threw. Nothing
 * escapes: the returned promise never rejects.
 *
 * @param task The work to run.
 * @returns A promise that always resolves.
 */
function settle(task: () => Promise<void> | void): Promise<void> {
  try {
    return Promise.resolve(task()).then(
      () => undefined,
      () => undefined
    )
  } catch {
    return Promise.resolve()
  }
}

/**
 * Writes one record through the logger's whole pipeline. This is the only place records are
 * produced, so a part that throws can't stop the other parts or reach the caller.
 *
 * @param shared The logger's shared parts.
 * @param base The attributes from `child()` calls.
 * @param level The record's level.
 * @param message The record's message.
 * @param attributes The attributes given to the logging call.
 */
function emit(
  shared: SharedLogger,
  base: LooseAttributes,
  level: Level,
  message: unknown,
  attributes: unknown
): void {
  try {
    if (!isEnabled(shared.config.level, level)) return

    const record: LogRecord = {
      time: readTime(shared.now),
      level,
      message: toMessage(message),
      attributes: mergeAttributes(base, attributes) as Attributes,
    }

    try {
      shared.write(record)
    } catch {
      // A record that can't be written is dropped: stdout never fails the app.
    }

    const exporter = shared.exporter

    if (!shared.closed && exporter !== undefined) {
      try {
        exporter.enqueue(record)
      } catch {
        // Sending a record must never fail the app.
      }
    }

    if (level !== 'error' || shared.closed) return

    const reporter = shared.reporter
    const error: unknown = record.attributes.error

    if (reporter === undefined || error === undefined || error === null) return

    try {
      reporter.capture(error, flattenAttributes(attributesWithoutError(record.attributes)))
    } catch {
      // Capturing an exception must never fail the app.
    }
  } catch {
    // No logging call may ever throw.
  }
}

/**
 * Waits for what is queued on both channels. It never rejects.
 *
 * @param shared The logger's shared parts.
 * @returns A promise that resolves when both channels are done.
 */
function flushShared(shared: SharedLogger): Promise<void> {
  const tasks: Promise<void>[] = []
  const exporter = shared.exporter
  const reporter = shared.reporter

  if (exporter !== undefined) tasks.push(settle(() => exporter.flush()))
  if (reporter !== undefined) tasks.push(settle(() => reporter.flush()))

  return Promise.all(tasks).then(
    () => undefined,
    () => undefined
  )
}

/**
 * Removes the fatal-error handlers, if this logger installed them. Removing twice is harmless.
 *
 * @param shared The logger's shared parts.
 */
function removeHandlers(shared: SharedLogger): void {
  const remove = shared.removeHandlers

  shared.removeHandlers = undefined

  try {
    remove?.()
  } catch {
    // Removing handlers never fails the app.
  }
}

/**
 * Stops both channels with the logger's time limit. Every call returns the first call's promise,
 * it never rejects, and afterwards records still go to stdout but nowhere else.
 *
 * @param shared The logger's shared parts.
 * @returns The first call's promise, which always resolves.
 */
function shutdownShared(shared: SharedLogger): Promise<void> {
  if (shared.shutdownPromise !== undefined) return shared.shutdownPromise

  shared.closed = true

  const tasks: Promise<void>[] = []
  const exporter = shared.exporter
  const reporter = shared.reporter

  if (exporter !== undefined) tasks.push(settle(() => exporter.shutdown(shared.timeoutMs)))
  if (reporter !== undefined) tasks.push(settle(() => reporter.shutdown(shared.timeoutMs)))

  shared.shutdownPromise = Promise.all(tasks).then(
    () => removeHandlers(shared),
    () => removeHandlers(shared)
  )

  return shared.shutdownPromise
}

/**
 * Turns the exporter's status into the record that is written to stdout when sending starts
 * failing or works again.
 *
 * @param status What the exporter reported.
 * @param now The clock. Defaults to `() => new Date()`.
 * @returns The record to write.
 */
export function statusRecord(
  status: ExporterStatus,
  now: () => Date = () => new Date()
): LogRecord {
  const time = readTime(now)

  if (status.state === 'failing') {
    return {
      time,
      level: 'warn',
      message: 'Sending Logs to PostHog is failing.',
      attributes: { reason: status.reason },
    }
  }

  return {
    time,
    level: 'info',
    message: 'Sending Logs to PostHog recovered.',
    attributes: { 'records.dropped': status.dropped },
  }
}

/**
 * Creates a function that writes a record to stdout only, after the same level check a logging
 * call gets. Status lines and the missing-service-name warning go through it, so they can never
 * reach the exporter or the reporter.
 *
 * @param config The logger's configuration, which supplies the format, the resource and the level.
 * @param write Where text goes. Defaults to `process.stdout.write`.
 * @returns A function that writes one record, obeying the level.
 */
export function createStdoutRecord(
  config: Config,
  write?: (text: string) => void
): (record: LogRecord) => void {
  const writeRecord = createStdoutWriter({
    format: config.format,
    resource: config.resource,
    write,
  })

  return (record: LogRecord): void => {
    try {
      if (!isEnabled(config.level, record.level)) return

      writeRecord(record)
    } catch {
      // A status line that can't be written is dropped.
    }
  }
}

/**
 * Creates the function `createLogger` hands to the exporter as `onStatus`. It turns each status
 * into a level-checked line on stdout, never into a record that is sent.
 *
 * @param config The logger's configuration, which supplies the format, the resource and the level.
 * @param write Where text goes. Defaults to `process.stdout.write`.
 * @returns A function that writes one status line.
 */
export function createStatusWriter(
  config: Config,
  write?: (text: string) => void
): (status: ExporterStatus) => void {
  const writeRecord = createStdoutRecord(config, write)

  return (status: ExporterStatus): void => {
    try {
      writeRecord(statusRecord(status))
    } catch {
      // A status line that can't be written is dropped.
    }
  }
}

/**
 * Tells whether the resource names the service with a non-empty string.
 *
 * @param resource The resource attributes.
 * @returns `true` when `service.name` is a non-empty string.
 */
function hasServiceName(resource: Resource): boolean {
  try {
    const name = resource['service.name']

    return typeof name === 'string' && name.length > 0
  } catch {
    return false
  }
}

/**
 * Reads a shutdown timeout, falling back when it isn't a usable number.
 *
 * @param value The timeout the caller gave.
 * @returns A number of milliseconds.
 */
function shutdownTimeoutOf(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return SHUTDOWN_TIMEOUT_MS

  return value
}

/**
 * Builds a logger from the given parts. Nothing a part does can make a logging call throw, reject
 * or wait, and the logger never sends anything through a part that wasn't given.
 *
 * @param parts The configuration, where stdout goes, and the optional sending parts.
 * @returns The logger.
 */
export function buildLogger(parts: LoggerParts): Logger {
  const timeoutMs = shutdownTimeoutOf(parts.shutdownTimeoutMs)
  const shared: SharedLogger = {
    config: parts.config,
    write: createStdoutWriter({
      format: parts.config.format,
      resource: parts.config.resource,
      write: parts.write,
    }),
    exporter: parts.exporter,
    reporter: parts.reporter,
    now: parts.now ?? (() => new Date()),
    timeoutMs,
    closed: false,
  }

  const create = (base: LooseAttributes): Logger => ({
    error(message: string, attributes?: LooseAttributes): void {
      emit(shared, base, 'error', message, attributes)
    },
    warn(message: string, attributes?: LooseAttributes): void {
      emit(shared, base, 'warn', message, attributes)
    },
    info(message: string, attributes?: LooseAttributes): void {
      emit(shared, base, 'info', message, attributes)
    },
    debug(message: string, attributes?: LooseAttributes): void {
      emit(shared, base, 'debug', message, attributes)
    },
    child(attributes: LooseAttributes): Logger {
      return create(childAttributes(base, attributes))
    },
    flush(): Promise<void> {
      return flushShared(shared)
    },
    shutdown(): Promise<void> {
      return shutdownShared(shared)
    },
  })

  const logger = create({})

  if (parts.handleFatalErrors === true) {
    shared.removeHandlers = installProcessHandlers({
      timeoutMs,
      process: parts.process,
      async onFatal(error, kind): Promise<void> {
        emit(
          shared,
          {},
          'error',
          kind === 'uncaughtException' ? 'Uncaught exception.' : 'Unhandled rejection.',
          { error }
        )

        // Flush rather than shut down: the app may have its own listener and keep running.
        await flushShared(shared)
      },
    })
  }

  return logger
}

/**
 * Creates a logger. With `POSTHOG_API_KEY` set it also sends Logs and exceptions to PostHog and
 * records uncaught exceptions and unhandled rejections; without it, it only writes to stdout.
 *
 * @param options The service name, version, environment and extra resource attributes.
 * @returns The logger. Creating one never throws.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  let config: Config

  try {
    config = resolveConfig(options)
  } catch {
    config = FALLBACK_CONFIG
  }

  /** Builds a logger that only writes to stdout, whatever happens. */
  const stdoutOnly = (): Logger => {
    try {
      return buildLogger({ config })
    } catch {
      return buildLogger({ config: FALLBACK_CONFIG })
    }
  }

  const posthog = config.posthog

  if (posthog === undefined) return stdoutOnly()

  try {
    const writeRecord = createStdoutRecord(config)
    const exporter = createOtlpExporter({
      endpoint: posthog.logsEndpoint,
      headers: posthog.logsHeaders,
      resource: config.resource,
      onStatus: createStatusWriter(config),
    })
    const reporter = createExceptionReporter({
      apiKey: posthog.apiKey,
      host: posthog.host,
      resource: config.resource,
    })
    const logger = buildLogger({ config, exporter, reporter, handleFatalErrors: true })

    if (!hasServiceName(config.resource)) {
      writeRecord({
        time: new Date(),
        level: 'warn',
        message: 'No service name is set.',
        attributes: { hint: 'Set OTEL_SERVICE_NAME or pass service to createLogger.' },
      })
    }

    return logger
  } catch {
    // A PostHog setup that fails for any reason falls back to stdout only.
    return stdoutOnly()
  }
}
