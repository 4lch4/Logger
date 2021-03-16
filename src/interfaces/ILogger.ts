import { Level } from "."

/**
 * The default logger that's exported by the module.
 */
export interface ILogger {
  /**
   * Writes the given message to stdout as an INFO level message.
   *
   * Info messages are written in Gray by default.
   */
  info: (msg: string) => void

  /**
   * Writes the given message to stdout as a WARNING level message.
   *
   * Warnings are written in Yellow by default.
   */
  warn: (msg: string) => void

  /**
   * Writes the given message to stdout as a DEBUG level message.
   *
   * Debug messages are written in Cyan by default.
   */
  debug: (msg: string) => void

  /**
   * Writes the given message/error to stdout as an ERROR level message. If any
   * other parameters are provided, they are written to stdout on a new line for
   * each parameter.
   *
   * Errors are written in Red by default.
   */
  error: (msg: string | Error, ..._extra: any[]) => void

  /**
   * Writes the given message to stdout as a SUCCESS level message.
   *
   * Success messages are written in Green by default.
   */
  success: (msg: string) => void

  /**
   * A generic purpose log function. Will write the given message to stdout
   * using the given Level. The color of the message will depend entirely on the
   * chosen Level.
   */
  log: (msg: string, level: Level) => void
}
