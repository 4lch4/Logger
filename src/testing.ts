import type { Attributes, Level, Logger, LogRecord, LooseAttributes, TestLogger } from './types.js'

/**
 * Merges attributes for a test record, later sources winning over earlier ones. A source that
 * isn't an object is ignored, and a key whose value is `undefined` is left out.
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
 * Creates a logger that records every call in memory, writes nothing to stdout and sends nothing
 * anywhere. It reads no environment variables and has no level filter.
 *
 * Every record has the time it was written, the level, the message and the attributes from
 * `child()` merged with the call's own, exactly as they were given: `error` keeps the value that
 * was passed and nothing is flattened. Children share the returned logger's `records` array,
 * oldest first, and keep recording after `shutdown()`.
 *
 * @returns The logger and its `records` array.
 */
export function createTestLogger(): TestLogger {
  const records: LogRecord[] = []

  /**
   * Builds a logger that adds the given attributes to every record.
   *
   * @param base The attributes the logger adds to every record.
   * @returns The logger.
   */
  const create = (base: LooseAttributes): Logger => {
    /**
     * Records one call.
     *
     * @param level The record's level.
     * @param message The record's message.
     * @param attributes The attributes given to the call.
     */
    const record = (level: Level, message: unknown, attributes: unknown): void => {
      try {
        records.push({
          time: new Date(),
          level,
          message: toMessage(message),
          attributes: mergeAttributes(base, attributes) as Attributes,
        })
      } catch {
        // Recording a call never throws, so a test can't fail here instead of at its assertion.
      }
    }

    return {
      error(message: string, attributes?: LooseAttributes): void {
        record('error', message, attributes)
      },
      warn(message: string, attributes?: LooseAttributes): void {
        record('warn', message, attributes)
      },
      info(message: string, attributes?: LooseAttributes): void {
        record('info', message, attributes)
      },
      debug(message: string, attributes?: LooseAttributes): void {
        record('debug', message, attributes)
      },
      child(attributes: LooseAttributes): Logger {
        const merged = mergeAttributes(base, attributes)

        // An error belongs to a record, so one given to `child` is ignored.
        delete merged.error

        return create(merged)
      },
      flush(): Promise<void> {
        return Promise.resolve()
      },
      shutdown(): Promise<void> {
        return Promise.resolve()
      },
    }
  }

  return { ...create({}), records }
}
