import { IColorOptions, LogFormat, Transports } from './index.js'

/**
 * The options that are available when instantiating a new Logger class.
 */
export interface ILoggerOptions {
  /** The format of the messages that are logged. */
  format?: LogFormat

  /** A set of options that specify which colors to use for which levels. */
  colorOpts?: IColorOptions

  /**
   * The {@link Transports transport(s)} which specify the where to send logs to.
   *
   * Default: {@link Transports.Console}
   */
  transports?: Transports[]

  /** The ingestion key to use for sending logs to Mezmo/LogDNA. */
  logDNAKey?: string
}
