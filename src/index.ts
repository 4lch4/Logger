import { createLogger } from './logger.js'
import { createTestLogger } from './testing.js'
import { LEVELS } from './types.js'
import type { AttributesOf, Level, Logger } from './types.js'

export { createLogger, createTestLogger, LEVELS }
export type {
  AttributePrimitive,
  Attributes,
  AttributesOf,
  AttributeValue,
  Level,
  Logger,
  LoggerOptions,
  LogRecord,
  TestLogger,
} from './types.js'

/** The real logger behind {@link logger}, created the first time something needs it. */
let defaultLogger: Logger | undefined

/**
 * Returns the real logger, creating it with `createLogger()` on first use. Importing this module
 * never creates one, so an app that only uses `createTestLogger` installs no handlers and sends
 * nothing.
 *
 * @returns The default logger.
 */
function realLogger(): Logger {
  defaultLogger ??= createLogger()

  return defaultLogger
}

/**
 * Passes a logging call on to the real logger, creating it first when it doesn't exist yet.
 *
 * @param level The level to write at.
 * @param message The message.
 * @param attributes The call's attributes.
 */
function writeDefault<T extends AttributesOf<T>>(
  level: Level,
  message: string,
  attributes?: T
): void {
  try {
    const logger = realLogger()

    switch (level) {
      case 'error':
        logger.error(message, attributes)
        return
      case 'warn':
        logger.warn(message, attributes)
        return
      case 'info':
        logger.info(message, attributes)
        return
      default:
        logger.debug(message, attributes)
    }
  } catch {
    // The default logger never throws, even when creating the real one fails.
  }
}

/**
 * The default logger for small apps. It is built from the environment alone, on first use: only
 * a call creates it, so importing the package writes nothing, installs no handlers and starts no
 * client. `flush()` and `shutdown()` resolve straight away when it was never created.
 */
export const logger: Logger = {
  error<T extends AttributesOf<T>>(message: string, attributes?: T): void {
    writeDefault('error', message, attributes)
  },
  warn<T extends AttributesOf<T>>(message: string, attributes?: T): void {
    writeDefault('warn', message, attributes)
  },
  info<T extends AttributesOf<T>>(message: string, attributes?: T): void {
    writeDefault('info', message, attributes)
  },
  debug<T extends AttributesOf<T>>(message: string, attributes?: T): void {
    writeDefault('debug', message, attributes)
  },
  child<T extends AttributesOf<T>>(attributes: T): Logger {
    return realLogger().child(attributes)
  },
  flush(): Promise<void> {
    return defaultLogger?.flush() ?? Promise.resolve()
  },
  shutdown(): Promise<void> {
    return defaultLogger?.shutdown() ?? Promise.resolve()
  },
}
