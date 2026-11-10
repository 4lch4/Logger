import type { AttributePrimitive, AttributeValue, LooseAttributes } from './types.js'

/** How many `cause`s deep a stack trace follows an error. */
const MAX_CAUSE_DEPTH = 5

/** An error described with OpenTelemetry's `exception.*` attributes. */
export interface ExceptionDescription {
  /** The error's name, such as `TypeError`, or the type of a thrown value that isn't an error. */
  type: string
  message: string
  /** The stack trace, followed by each `cause`'s. Absent when the value has no stack. */
  stacktrace?: string
}

/** Whether the value looks like an `Error`, including errors from another realm. */
function isErrorLike(
  value: unknown
): value is { name?: unknown; message: unknown; stack?: unknown; cause?: unknown } {
  return typeof value === 'object' && value !== null && 'message' in value
}

/** Turns any value into text without ever throwing. */
function toText(value: unknown): string {
  if (typeof value === 'string') return value

  try {
    if (typeof value === 'object' && value !== null) {
      const json = JSON.stringify(value)

      if (json !== undefined) return json
    }

    return String(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

/**
 * Describes anything that was thrown or rejected. It never throws, whatever it's given.
 *
 * @param error The thrown or rejected value.
 * @returns Its type, message and, when it has one, its stack trace with each `cause`'s after it.
 */
export function describeError(error: unknown): ExceptionDescription {
  try {
    if (!isErrorLike(error)) {
      return { type: error === null ? 'null' : typeof error, message: toText(error) }
    }

    const name = typeof error.name === 'string' && error.name ? error.name : 'Error'
    const description: ExceptionDescription = { type: name, message: toText(error.message) }
    const stacks: string[] = []
    let current: unknown = error

    for (let depth = 0; depth <= MAX_CAUSE_DEPTH && isErrorLike(current); depth++) {
      if (typeof current.stack === 'string' && current.stack) {
        stacks.push(depth === 0 ? current.stack : `Caused by: ${current.stack}`)
      }

      current = current.cause
    }

    if (stacks.length > 0) description.stacktrace = stacks.join('\n')

    return description
  } catch {
    return { type: 'Error', message: 'The error could not be described.' }
  }
}

/** Turns one item of an array attribute into a string, number or boolean. */
function toPrimitive(value: unknown): AttributePrimitive {
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()

  return toText(value)
}

/**
 * Turns any value into a valid attribute value. TypeScript callers already pass valid ones; this
 * is for values that got past the types, such as a `Date`, a `bigint`, `NaN` or a nested object.
 *
 * @param value The value to convert.
 * @returns The value as an attribute value, or `undefined` when it should be left out.
 */
export function toAttributeValue(value: unknown): AttributeValue | undefined {
  if (value === undefined || value === null) return undefined
  if (Array.isArray(value)) return value.map(toPrimitive)

  return toPrimitive(value)
}

/**
 * Turns a record's attributes into what is written and sent: `undefined` values are left out,
 * every other value is made valid, and `error` becomes `exception.type`, `exception.message` and
 * `exception.stacktrace`. An `exception.*` attribute the caller set itself is kept. It never
 * throws.
 *
 * @param attributes The record's attributes, with or without `error`.
 * @returns A flat object that is safe to serialize, without an `error` key.
 */
export function flattenAttributes(attributes: LooseAttributes): Record<string, AttributeValue> {
  const flat: Record<string, AttributeValue> = {}

  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'error') continue

    const converted = toAttributeValue(value)

    if (converted !== undefined) flat[key] = converted
  }

  const error: unknown = attributes.error

  if (error !== undefined && error !== null) {
    const { type, message, stacktrace } = describeError(error)

    flat['exception.type'] ??= type
    flat['exception.message'] ??= message
    if (stacktrace !== undefined) flat['exception.stacktrace'] ??= stacktrace
  }

  return flat
}
