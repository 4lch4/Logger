import { LogLevel } from '@interfaces/index.js'

export interface ILoggerInput {
  /** Allows for any extra properties to be appended by the user. */
  [key: string]: any

  /** The message content to log. */
  msg: string

  /** The log level to send the data to. */
  level: LogLevel
}
