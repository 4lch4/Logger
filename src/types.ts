//#region Public types

/**
 * The four levels a record can have:
 *
 * - `error`: a person or agent must act. With an `error` attribute it also creates an exception in
 *   PostHog's error tracking.
 * - `warn`: something degraded, but it recovered or was worked around.
 * - `info`: a state change, such as startup, shutdown or a delivery.
 * - `debug`: detail for development. Never on in production.
 */
export type Level = 'error' | 'warn' | 'info' | 'debug'

/** Every {@link Level}, most severe first. */
export const LEVELS: readonly Level[] = ['error', 'warn', 'info', 'debug']

/** A single value inside an attribute. */
export type AttributePrimitive = string | number | boolean

/** The value of an attribute: a string, number or boolean, or an array of those. */
export type AttributeValue = AttributePrimitive | readonly AttributePrimitive[]

/**
 * The attributes of a record: a flat object of {@link AttributeValue}s with dotted keys, such as
 * `{ 'notification.source': 'ci' }`. An attribute whose value is `undefined` is left out.
 *
 * `error` is the one exception. It takes anything that was thrown or rejected, and it's written as
 * `exception.type`, `exception.message` and `exception.stacktrace`.
 */
export interface Attributes {
  [key: string]: AttributeValue | undefined
  /**
   * The thrown or rejected value this record is about. Read it as `unknown`: it's declared `any`
   * only because an index signature doesn't allow a property of type `unknown` beside it.
   */
  error?: any
}

/**
 * Checks an attributes argument key by key: `error` may be anything, and every other key must
 * hold an {@link AttributeValue} or `undefined`. The logging methods use it, so a call such as
 * `logger.error('Delivery failed.', { error })` accepts the `unknown` from a `catch` while a
 * nested object or a `Date` is still a compile error.
 */
export type AttributesOf<T> = {
  [K in keyof T]: K extends 'error' ? unknown : AttributeValue | undefined
}

/**
 * Attributes as an implementation receives them. Implement {@link Logger}'s methods with this
 * parameter type; `flattenAttributes` makes every value valid at run time.
 */
export type LooseAttributes = Readonly<Record<string, unknown>>

/** The options of `createLogger`. An option given here wins over the environment. */
export interface LoggerOptions {
  /** `service.name`. Defaults to `OTEL_SERVICE_NAME`, then `OTEL_RESOURCE_ATTRIBUTES`. */
  service?: string
  /** `service.version`, normally from the app's `package.json`. */
  version?: string
  /** `deployment.environment.name`, such as `production` or `development`. */
  environment?: string
  /** Extra resource attributes to put on every record and exception. */
  attributes?: Record<string, AttributeValue>
}

/** A logger. Create one with `createLogger`, or with `createTestLogger` in tests. */
export interface Logger {
  /** Writes a record a person or agent must act on. */
  error<T extends AttributesOf<T>>(message: string, attributes?: T): void
  /** Writes a record about something degraded that recovered or was worked around. */
  warn<T extends AttributesOf<T>>(message: string, attributes?: T): void
  /** Writes a record about a state change. */
  info<T extends AttributesOf<T>>(message: string, attributes?: T): void
  /** Writes a record with detail for development. */
  debug<T extends AttributesOf<T>>(message: string, attributes?: T): void
  /**
   * Returns a logger that adds the given attributes to every record. A record's own attribute
   * wins over one with the same key from here. An `error` given here is ignored.
   */
  child<T extends AttributesOf<T>>(attributes: T): Logger
  /** Sends everything that is queued. Resolves when it's sent or has failed; never rejects. */
  flush(): Promise<void>
  /**
   * Flushes with a time limit and stops sending. After it, records are still written to stdout.
   * Safe to call more than once. Never rejects.
   */
  shutdown(): Promise<void>
}

/** One record, as a logger hands it to stdout and to PostHog. */
export interface LogRecord {
  /** When the record was written. */
  time: Date
  level: Level
  message: string
  /** The attributes from `child()` merged with the record's own, with `error` when one was given. */
  attributes: Attributes
}

/** The logger `createTestLogger` returns. It sends nothing and writes nothing. */
export interface TestLogger extends Logger {
  /** Every record written through this logger or one of its children, oldest first. */
  readonly records: LogRecord[]
}

//#endregion Public types

//#region Internal contracts
// Everything below is shared between this package's modules and isn't exported from `index.ts`.

/** The resource attributes that go on every record and exception, such as `service.name`. */
export type Resource = Record<string, AttributeValue>

/** How records are written to stdout: one JSON object per line, or one readable line. */
export type StdoutFormat = 'json' | 'pretty'

/** Where and how to send to PostHog. Only present when `POSTHOG_API_KEY` is set. */
export interface PostHogConfig {
  /** The project key (`phc_…`). */
  apiKey: string
  /** PostHog's host without a trailing slash, such as `https://us.i.posthog.com`. */
  host: string
  /** The full URL OTLP log requests are posted to. */
  logsEndpoint: string
  /** The headers of each OTLP request, apart from `content-type`. */
  logsHeaders: Record<string, string>
}

/** Everything a logger needs, worked out from `LoggerOptions` and the environment. */
export interface Config {
  /** Records below this level are dropped. */
  level: Level
  format: StdoutFormat
  resource: Resource
  /** `undefined` means stdout only: nothing is sent anywhere. */
  posthog?: PostHogConfig
}

/** What the OTLP exporter reports when sending starts failing and when it works again. */
export type ExporterStatus =
  | {
      state: 'failing'
      /** Why the first failed request failed, such as `HTTP 503` or the network error's text. */
      reason: string
    }
  | {
      state: 'recovered'
      /** How many records were dropped while sending was failing. */
      dropped: number
    }

/** Sends records to PostHog's Logs. No method ever throws or rejects. */
export interface LogExporter {
  /** Queues a record. Returns at once. */
  enqueue(record: LogRecord): void
  /** Tries once to send everything that is queued, without waiting for a backoff to pass. */
  flush(): Promise<void>
  /** Flushes, giving up after `timeoutMs`, then stops the timer and accepts no more records. */
  shutdown(timeoutMs: number): Promise<void>
}

/** Sends exceptions to PostHog's error tracking. No method ever throws or rejects. */
export interface ExceptionReporter {
  /**
   * Queues an exception. `attributes` are the record's attributes without `error`; the reporter
   * adds the resource attributes itself.
   */
  capture(error: unknown, attributes: Record<string, AttributeValue>): void
  /** Sends everything that is queued. */
  flush(): Promise<void>
  /** Flushes, giving up after `timeoutMs`, then accepts no more exceptions. */
  shutdown(timeoutMs: number): Promise<void>
}

//#endregion Internal contracts
