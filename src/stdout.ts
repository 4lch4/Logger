import { flattenAttributes } from './attributes.js'
import type { AttributeValue, Level, LogRecord, Resource, StdoutFormat } from './types.js'

/** The ANSI color that starts each level in the readable format. */
const LEVEL_COLORS: Record<Level, string> = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
}

/** The ANSI escape that dims text, used on the attribute keys. */
const DIM = '\x1b[2m'

/** The ANSI escape that turns off color and dimming. */
const RESET = '\x1b[0m'

/** The keys a JSON line uses for itself, which an attribute may not take. */
const RESERVED_KEYS: ReadonlySet<string> = new Set(['time', 'level', 'message'])

/** What the writer needs to write records. */
export interface StdoutWriterOptions {
  /** How records are written: one JSON object per line, or one readable line. */
  format: StdoutFormat
  /** The resource attributes that go on every record. */
  resource: Resource
  /**
   * Colors in the readable format. Defaults to true unless the `NO_COLOR` variable is set to a
   * non-empty value.
   */
  color?: boolean
  /** Where text goes. Defaults to `process.stdout.write`. */
  write?: (text: string) => void
}

/**
 * Returns the record's time, or the current time when it has an invalid date.
 *
 * @param record The record to read.
 * @returns A valid date.
 */
function timeOf(record: LogRecord): Date {
  const time = record.time

  return time instanceof Date && !Number.isNaN(time.getTime()) ? time : new Date()
}

/** Writes the local time of day as `HH:MM:SS`, zero-padded and in 24-hour form. */
function clockOf(time: Date): string {
  return [time.getHours(), time.getMinutes(), time.getSeconds()]
    .map(part => String(part).padStart(2, '0'))
    .join(':')
}

/** Writes the level in upper case, padded with spaces to five characters. */
function levelOf(level: Level): string {
  return typeof level === 'string' ? level.toUpperCase().padEnd(5) : 'ERROR'
}

/** Writes the level, colored when asked to, followed by the reset escape. */
function paintedLevel(level: Level, color: boolean): string {
  const text = levelOf(level)

  if (!color) return text

  return `${LEVEL_COLORS[level] ?? ''}${text}${RESET}`
}

/**
 * Writes an attribute value for the readable format. A string is bare unless it is empty or holds
 * whitespace, a double quote or an `=`, and arrays are written as JSON.
 *
 * @param value The value to write.
 * @returns The value's text.
 */
function formatValue(value: AttributeValue): string {
  if (typeof value === 'string') {
    return value === '' || /[\s"=]/.test(value) ? JSON.stringify(value) : value
  }

  if (Array.isArray(value)) return JSON.stringify(value)

  return String(value)
}

/** The JSON line written when a record can't be serialized: just its time, level and message. */
function fallbackJson(time: Date, record: LogRecord): string {
  const iso = time.toISOString()

  try {
    return JSON.stringify({ time: iso, level: record.level, message: record.message })
  } catch {
    return `{"time":"${iso}","level":"error","message":"The record could not be written."}`
  }
}

/** The readable line written when a record can't be formatted: just its time, level and message. */
function fallbackPretty(time: Date, record: LogRecord): string {
  let message = 'The record could not be written.'

  try {
    if (typeof record.message === 'string') message = record.message
  } catch {
    // Keep the placeholder: reading the message is what failed.
  }

  return `${clockOf(time)} ${levelOf(record.level)} ${message}`
}

/**
 * Writes a record as one JSON object on one line, with no trailing newline. The keys are `time`,
 * `level`, `message`, the resource attributes in their own order, and then the record's
 * attributes. A record attribute named `time`, `level` or `message` becomes `attribute.<name>`,
 * and one that clashes with a resource attribute is left out, as is a resource attribute that
 * takes a reserved name. It never throws.
 *
 * @param record The record to write.
 * @param resource The resource attributes that go on every record.
 * @returns The JSON line.
 */
export function formatJson(record: LogRecord, resource: Resource): string {
  const time = timeOf(record)

  try {
    const line: Record<string, unknown> = {
      time: time.toISOString(),
      level: record.level,
      message: record.message,
    }

    for (const [key, value] of Object.entries(resource)) {
      if (!RESERVED_KEYS.has(key)) line[key] = value
    }

    for (const [key, value] of Object.entries(flattenAttributes(record.attributes))) {
      if (Object.hasOwn(resource, key)) continue

      line[RESERVED_KEYS.has(key) ? `attribute.${key}` : key] = value
    }

    return JSON.stringify(line)
  } catch {
    return fallbackJson(time, record)
  }
}

/**
 * Writes a record as one readable line for a terminal, with no trailing newline: the local time,
 * the level padded to five characters, the message, and then each attribute as `key=value`. A
 * stack trace follows on its own lines, indented by four spaces. It never throws.
 *
 * @param record The record to write.
 * @param options `color` wraps the level in its color and dims each `key=`; it defaults to false
 *   here, and the writer turns it on for a terminal.
 * @returns The readable line.
 */
export function formatPretty(record: LogRecord, options: { color?: boolean } = {}): string {
  const time = timeOf(record)
  const color = options.color === true

  try {
    const flat = flattenAttributes(record.attributes)
    const stacktrace = flat['exception.stacktrace']
    let line = `${clockOf(time)} ${paintedLevel(record.level, color)} ${record.message}`

    for (const [key, value] of Object.entries(flat)) {
      if (key === 'exception.stacktrace') continue

      const text = formatValue(value)

      line += color ? ` ${DIM}${key}=${RESET}${text}` : ` ${key}=${text}`
    }

    if (typeof stacktrace === 'string' && stacktrace !== '') {
      line += `\n${stacktrace
        .split('\n')
        .map(part => `    ${part}`)
        .join('\n')}`
    }

    return line
  } catch {
    return fallbackPretty(time, record)
  }
}

/**
 * Creates a function that writes each record to stdout in the chosen format, followed by a
 * newline. It never throws, even when writing does, such as when stdout closes with `EPIPE`.
 *
 * @param options The format, the resource attributes, and where to write.
 * @returns A function that writes one record.
 */
export function createStdoutWriter(options: StdoutWriterOptions): (record: LogRecord) => void {
  const color = options.color ?? !process.env.NO_COLOR
  const write = options.write ?? ((text: string) => process.stdout.write(text))

  return (record: LogRecord): void => {
    try {
      const text =
        options.format === 'json'
          ? formatJson(record, options.resource)
          : formatPretty(record, { color })

      write(`${text}\n`)
    } catch {
      // A record that can't be written is dropped: the logger never throws or blocks the app.
    }
  }
}
