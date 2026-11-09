import { createRequire } from 'node:module'
import { flattenAttributes } from './attributes.js'
import type {
  AttributeValue,
  ExporterStatus,
  Level,
  LogExporter,
  LogRecord,
  Resource,
} from './types.js'

/** The scope name on every payload: this package produced the records. */
const SCOPE_NAME = '@4lch4/logger'

/**
 * Reads this package's version from its own `package.json`, which is always published beside
 * `dist`. Returns `undefined` when it can't be read, and never throws.
 */
function readPackageVersion(): string | undefined {
  try {
    const manifest: unknown = createRequire(import.meta.url)('../package.json')

    if (typeof manifest !== 'object' || manifest === null || !('version' in manifest)) {
      return undefined
    }

    return typeof manifest.version === 'string' ? manifest.version : undefined
  } catch {
    return undefined
  }
}

/** The scope on every payload: this package's name and, when it can be read, its version. */
const SCOPE: { name: string; version?: string } = (() => {
  const version = readPackageVersion()

  return version === undefined ? { name: SCOPE_NAME } : { name: SCOPE_NAME, version }
})()

/** The name of the header every request carries. */
const CONTENT_TYPE = 'application/json'

/** OTLP's severity number for each of this package's levels. */
const SEVERITY_NUMBERS: Record<Level, number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
}

/** One attribute value, in OTLP/HTTP's JSON encoding. */
export type OtlpAnyValue =
  | { stringValue: string }
  | { boolValue: boolean }
  | { intValue: string }
  | { doubleValue: number }
  | { arrayValue: { values: OtlpAnyValue[] } }

/** One attribute, in OTLP/HTTP's JSON encoding. */
export interface OtlpKeyValue {
  /** The attribute's dotted key. */
  key: string
  /** The attribute's typed value. */
  value: OtlpAnyValue
}

/** One log record, in OTLP/HTTP's JSON encoding. */
export interface OtlpLogRecord {
  /** When the record was written, in nanoseconds since the Unix epoch, as a decimal string. */
  timeUnixNano: string
  /** When the record was observed. This package sets it to the record's time. */
  observedTimeUnixNano: string
  /** OTLP's severity number: 5, 9, 13 or 17. */
  severityNumber: number
  /** The level in upper case, such as `INFO`. */
  severityText: string
  /** The message. */
  body: OtlpAnyValue
  /** The record's flattened attributes, in the order they were written. */
  attributes: OtlpKeyValue[]
}

/** One scope's log records, in OTLP/HTTP's JSON encoding. */
export interface OtlpScopeLogs {
  /** The package that produced the records, with its version when it's known. */
  scope: { name: string; version?: string }
  /** The records, oldest first. */
  logRecords: OtlpLogRecord[]
}

/** One resource's log records, in OTLP/HTTP's JSON encoding. */
export interface OtlpResourceLogs {
  /** The resource attributes, such as `service.name`, shared by every record. */
  resource: { attributes: OtlpKeyValue[] }
  /** The scope's records. */
  scopeLogs: OtlpScopeLogs[]
}

/** An OTLP/HTTP JSON request body with log records. */
export interface OtlpLogsPayload {
  /** The resource groups. This package always sends exactly one. */
  resourceLogs: OtlpResourceLogs[]
}

/** The options of {@link createOtlpExporter}. */
export interface OtlpExporterOptions {
  /** The full URL to post to. */
  endpoint: string
  /** Request headers, apart from `content-type`. */
  headers: Record<string, string>
  /** The attributes that go on every record, such as `service.name`. */
  resource: Resource
  /** Called once when sending starts failing and once when it works again. */
  onStatus?: (status: ExporterStatus) => void
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** How often queued records are sent. Defaults to 5,000 ms. */
  flushIntervalMs?: number
  /** The most records in one request. Defaults to 100. */
  maxBatchRecords?: number
  /** The most records the queue holds before dropping the oldest. Defaults to 1,000. */
  maxQueueRecords?: number
  /** The most bytes in one request body. Defaults to 2 MiB. */
  maxRequestBytes?: number
  /** How long a request may take before it's aborted. Defaults to 10,000 ms. */
  requestTimeoutMs?: number
  /** The wait after the first failure. Defaults to 1,000 ms. */
  initialBackoffMs?: number
  /** The longest wait between attempts. Defaults to 60,000 ms. */
  maxBackoffMs?: number
}

/** One batch that is ready to send, with the body that was serialized for it. */
interface Batch {
  /** The records in the batch, oldest first. */
  records: LogRecord[]
  /** The JSON body, serialized once so it isn't built again on the way out. */
  body: string
}

/** What happened to a request. */
type SendResult =
  | { ok: true }
  | {
      ok: false
      /** Whether the same batch can succeed if it's sent again. */
      retryable: boolean
      /** Short text for the status, such as `HTTP 503` or a network error's message. */
      reason: string
    }

/**
 * Turns one attribute value into its OTLP/HTTP JSON encoding.
 *
 * @param value The value to convert.
 * @returns The value as an OTLP `AnyValue`.
 */
export function toOtlpValue(value: AttributeValue): OtlpAnyValue {
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { boolValue: value }

  if (typeof value === 'number') {
    // OTLP JSON writes 64-bit integers as decimal strings, and only safe integers fit in one.
    return Number.isSafeInteger(value) ? { intValue: String(value) } : { doubleValue: value }
  }

  return { arrayValue: { values: value.map(item => toOtlpValue(item)) } }
}

/**
 * Builds the body of an OTLP/HTTP JSON request for the given records.
 *
 * @param records The records to send, oldest first.
 * @param resource The attributes that go on every record.
 * @returns The payload, with one resource, one scope and one record per input record.
 */
export function buildPayload(records: readonly LogRecord[], resource: Resource): OtlpLogsPayload {
  return {
    resourceLogs: [
      {
        resource: { attributes: toKeyValues(resource) },
        scopeLogs: [
          {
            scope: SCOPE,
            logRecords: records.map(toLogRecord),
          },
        ],
      },
    ],
  }
}

/**
 * Creates an exporter that batches records and posts them as OTLP/HTTP JSON. It never blocks,
 * throws, rejects or otherwise delays the app, whatever the server does.
 *
 * @param options Where to send, how often, and how much. See {@link OtlpExporterOptions}.
 * @returns The exporter. Its `shutdown` should be called when the app stops.
 */
export function createOtlpExporter(options: OtlpExporterOptions): LogExporter {
  const endpoint = options.endpoint
  const resource = options.resource
  const fetchImpl = options.fetch ?? globalThis.fetch
  const requestHeaders: Record<string, string> = {
    ...options.headers,
    'content-type': CONTENT_TYPE,
  }
  const flushIntervalMs = durationOption(options.flushIntervalMs, 5_000)
  const maxBatchRecords = countOption(options.maxBatchRecords, 100)
  const maxQueueRecords = countOption(options.maxQueueRecords, 1_000)
  const maxRequestBytes = countOption(options.maxRequestBytes, 2 * 1024 * 1024)
  const requestTimeoutMs = durationOption(options.requestTimeoutMs, 10_000)
  const initialBackoffMs = durationOption(options.initialBackoffMs, 1_000)
  const maxBackoffMs = durationOption(options.maxBackoffMs, 60_000)

  /** The records waiting to be sent, oldest first. */
  const queue: LogRecord[] = []

  /** Serializes every send: one request is in flight at a time. */
  let lock: Promise<void> = Promise.resolve()

  /** Whether an automatic send is already waiting for the lock. */
  let automaticQueued = false

  /** The interval that sends what is queued, started on the first `enqueue`. */
  let interval: ReturnType<typeof setInterval> | undefined

  /** The timer that waits out a backoff. It's set while a backoff is being waited out. */
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  /** How many attempts in a row have failed. Reset by a success. */
  let failures = 0

  /** Whether `failing` has been reported and `recovered` hasn't yet. */
  let failing = false

  /** How many records were dropped since `failing` was reported. */
  let droppedWhileFailing = 0

  /** Set by `shutdown`. No record is accepted after it. */
  let closed = false

  /** The first `shutdown` call's promise, returned by every later call. */
  let shutdownPromise: Promise<void> | undefined

  /** Aborts a request that is still in flight when `shutdown` is done, so it can't hold the process open. */
  const shutdownController = new AbortController()

  /**
   * A single operation that must not run beside another send.
   *
   * @param operation The work to run with the lock.
   * @returns A promise for the operation's result.
   */
  function runExclusive(operation: () => Promise<void>): Promise<void> {
    const result = lock.then(operation, operation)

    lock = result.then(ignore, ignore)

    return result
  }

  /** Reports a status to the caller, ignoring a callback that throws. */
  function reportStatus(status: ExporterStatus): void {
    if (options.onStatus === undefined) return

    try {
      options.onStatus(status)
    } catch {
      // A status callback that throws must not break the exporter.
    }
  }

  /** Counts records that were dropped while sending was failing. */
  function recordDropped(count: number): void {
    if (count > 0 && failing) droppedWhileFailing += count
  }

  /** Records a failed attempt, reporting `failing` only on the first one in a row. */
  function recordFailure(reason: string): void {
    failures += 1
    if (failing) return

    failing = true
    droppedWhileFailing = 0
    reportStatus({ state: 'failing', reason })
  }

  /** Records a successful attempt, reporting `recovered` if sending had been failing. */
  function recordSuccess(): void {
    failures = 0
    if (!failing) return

    failing = false

    const dropped = droppedWhileFailing

    droppedWhileFailing = 0
    reportStatus({ state: 'recovered', dropped })
  }

  /** Stops the backoff timer, if one is set. */
  function clearRetryTimer(): void {
    if (retryTimer === undefined) return

    clearTimeout(retryTimer)
    retryTimer = undefined
  }

  /** Waits out the backoff before the next automatic attempt. */
  function startBackoff(): void {
    if (closed) return

    clearRetryTimer()

    const exponent = Math.max(0, failures - 1)
    const delay = Math.min(initialBackoffMs * 2 ** exponent, maxBackoffMs)

    retryTimer = setTimeout(onRetry, delay)
    retryTimer.unref?.()
  }

  /** Sends again once a backoff has passed. */
  function onRetry(): void {
    retryTimer = undefined

    try {
      startAutomatic(true)
    } catch {
      // Nothing may escape a timer callback.
    }
  }

  /** Drops the oldest records until the queue fits its cap. */
  function trimQueue(): void {
    const excess = queue.length - maxQueueRecords

    if (excess <= 0) return

    queue.splice(0, excess)
    recordDropped(excess)
  }

  /** Puts a failed batch back at the front of the queue, then applies the cap. */
  function returnToFront(records: readonly LogRecord[]): void {
    const rest = queue.splice(0, queue.length)

    for (const record of records) queue.push(record)
    for (const record of rest) queue.push(record)

    trimQueue()
  }

  /** Serializes a candidate batch, returning `undefined` when it can't be serialized. */
  function serialize(records: readonly LogRecord[]): { body: string; bytes: number } | undefined {
    try {
      const body = JSON.stringify(buildPayload(records, resource))

      return { body, bytes: Buffer.byteLength(body) }
    } catch {
      return undefined
    }
  }

  /**
   * Takes the next batch off the front of the queue: at most `maxBatchRecords` records, and a
   * body of at most `maxRequestBytes` bytes. A record that's too big on its own is dropped.
   *
   * @returns The batch, or `undefined` when nothing is left to send.
   */
  function takeBatch(): Batch | undefined {
    while (queue.length > 0) {
      const candidates = queue.slice(0, maxBatchRecords)
      const full = serialize(candidates)

      if (full !== undefined && full.bytes <= maxRequestBytes) {
        queue.splice(0, candidates.length)

        return { records: candidates, body: full.body }
      }

      if (candidates.length > 1) {
        // Prefixes only get bigger, so a binary search finds the longest one that still fits.
        let low = 1
        let high = candidates.length - 1
        let best: { count: number; body: string } | undefined

        while (low <= high) {
          const middle = (low + high) >> 1
          const attempt = serialize(candidates.slice(0, middle))

          if (attempt !== undefined && attempt.bytes <= maxRequestBytes) {
            best = { count: middle, body: attempt.body }
            low = middle + 1
          } else {
            high = middle - 1
          }
        }

        if (best !== undefined) {
          queue.splice(0, best.count)

          return { records: candidates.slice(0, best.count), body: best.body }
        }
      }

      // Not even the first record fits on its own, so sending it can never succeed.
      queue.shift()
      recordDropped(1)
    }

    return undefined
  }

  /**
   * Posts one batch.
   *
   * @param batch The batch to send.
   * @returns Whether it succeeded, and if not, whether sending it again could work.
   */
  async function sendBatch(batch: Batch): Promise<SendResult> {
    try {
      if (typeof fetchImpl !== 'function') {
        return { ok: false, retryable: true, reason: 'fetch is not available' }
      }

      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: requestHeaders,
        body: batch.body,
        signal: AbortSignal.any([AbortSignal.timeout(requestTimeoutMs), shutdownController.signal]),
      })

      discardBody(response)

      const status = readStatus(response)

      if (status >= 200 && status < 300) return { ok: true }
      if (status === 0) return { ok: false, retryable: true, reason: 'No response status' }

      return {
        ok: false,
        retryable: status === 429 || status >= 500,
        reason: `HTTP ${status}`,
      }
    } catch (error) {
      return { ok: false, retryable: true, reason: failureReason(error) }
    }
  }

  /** Restores or drops a failed batch, reports the failure and waits before trying again. */
  function handleFailure(batch: Batch, result: { retryable: boolean; reason: string }): void {
    // A request that shutdown aborted says nothing about the server, so it isn't reported.
    if (shutdownController.signal.aborted) return

    recordFailure(result.reason)

    if (result.retryable) {
      returnToFront(batch.records)
    } else {
      recordDropped(batch.records.length)
    }

    startBackoff()
  }

  /** Sends queued batches until the queue is smaller than one batch. */
  async function runAutomatic(): Promise<void> {
    try {
      while (!closed && retryTimer === undefined && queue.length > 0) {
        const batch = takeBatch()

        if (batch === undefined) return

        const result = await sendBatch(batch)

        if (!result.ok) {
          handleFailure(batch, result)
          return
        }

        recordSuccess()

        if (queue.length < maxBatchRecords) return
      }
    } catch {
      // Sending must never surface an error.
    }
  }

  /** Starts an automatic send, unless one is running or a backoff is being waited out. */
  function startAutomatic(anySize: boolean): void {
    if (closed || retryTimer !== undefined || automaticQueued) return
    if (queue.length === 0) return
    if (!anySize && queue.length < maxBatchRecords) return

    automaticQueued = true

    runExclusive(async () => {
      automaticQueued = false
      if (closed || retryTimer !== undefined || queue.length === 0) return

      await runAutomatic()
    }).catch(ignore)
  }

  /** Sends everything queued, batch after batch, ignoring any backoff. */
  async function runFlush(): Promise<void> {
    try {
      clearRetryTimer()

      while (queue.length > 0) {
        const batch = takeBatch()

        if (batch === undefined) return

        const result = await sendBatch(batch)

        if (!result.ok) {
          handleFailure(batch, result)
          return
        }

        recordSuccess()
      }
    } catch {
      // Flushing must never reject.
    }
  }

  /** Sends what is queued, after any request in flight. */
  function flush(): Promise<void> {
    try {
      return runExclusive(runFlush).then(ignore, ignore)
    } catch {
      return Promise.resolve()
    }
  }

  /** Sends what is queued when the interval fires. */
  function onInterval(): void {
    try {
      startAutomatic(true)
    } catch {
      // Nothing may escape a timer callback.
    }
  }

  /** Stops the interval and the backoff timer. */
  function clearTimers(): void {
    if (interval !== undefined) {
      clearInterval(interval)
      interval = undefined
    }

    clearRetryTimer()
  }

  return {
    enqueue(record) {
      try {
        if (closed) return

        if (interval === undefined) {
          interval = setInterval(onInterval, flushIntervalMs)
          interval.unref?.()
        }

        queue.push(record)
        trimQueue()

        if (queue.length >= maxBatchRecords) startAutomatic(false)
      } catch {
        // Enqueuing must never throw.
      }
    },
    flush,
    shutdown(timeoutMs) {
      if (shutdownPromise !== undefined) return shutdownPromise

      closed = true

      shutdownPromise = (async () => {
        let timer: ReturnType<typeof setTimeout> | undefined

        try {
          const deadline = new Promise<void>(resolve => {
            timer = setTimeout(resolve, durationOption(timeoutMs, 0))
            timer.unref?.()
          })

          await Promise.race([flush(), deadline])
        } catch {
          // Shutting down must never reject.
        } finally {
          if (timer !== undefined) clearTimeout(timer)

          clearTimers()
          shutdownController.abort()
        }
      })()

      return shutdownPromise
    },
  }
}

/**
 * Turns a flat attribute object into OTLP key/value pairs, in the object's key order.
 *
 * @param attributes The attributes to convert.
 * @returns The attributes as OTLP `KeyValue`s.
 */
function toKeyValues(attributes: Record<string, AttributeValue>): OtlpKeyValue[] {
  return Object.entries(attributes).map(([key, value]) => ({
    key,
    value: toOtlpValue(value),
  }))
}

/**
 * Turns a record into its OTLP encoding.
 *
 * @param record The record to convert.
 * @returns The record as an OTLP `LogRecord`.
 */
function toLogRecord(record: LogRecord): OtlpLogRecord {
  const time =
    record.time instanceof Date && !Number.isNaN(record.time.getTime()) ? record.time : new Date()
  const nanos = String(BigInt(time.getTime()) * 1_000_000n)

  return {
    timeUnixNano: nanos,
    observedTimeUnixNano: nanos,
    severityNumber: SEVERITY_NUMBERS[record.level],
    severityText: record.level.toUpperCase(),
    body: { stringValue: record.message },
    attributes: toKeyValues(flattenAttributes(record.attributes)),
  }
}

/** Reads a response's status, treating a response without one as zero. */
function readStatus(response: Response): number {
  try {
    return typeof response.status === 'number' ? response.status : 0
  } catch {
    return 0
  }
}

/** Cancels a response's body so its connection is freed without reading it. */
function discardBody(response: Response): void {
  try {
    const body: unknown = response.body

    if (body === null || typeof body !== 'object' || !('cancel' in body)) return

    const cancel = body.cancel

    if (typeof cancel === 'function') {
      void Promise.resolve(cancel.call(body)).catch(ignore)
    }
  } catch {
    // A body that can't be cancelled is left to the runtime.
  }
}

/** Turns a thrown value into short text for a status message. */
function failureReason(error: unknown): string {
  try {
    if (error instanceof Error && error.message) return error.message

    return String(error)
  } catch {
    return 'Unknown error'
  }
}

/** Reads a duration option, falling back when it isn't a usable number. */
function durationOption(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback

  return value
}

/** Reads a count option, falling back when it isn't a usable number. */
function countOption(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return fallback

  return Math.floor(value)
}

/** Does nothing, for a promise handler that keeps a rejection from going unhandled. */
function ignore(): void {}
