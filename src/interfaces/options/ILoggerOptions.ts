import { IColorOptions, LogTransport, OutputFormat } from '../index.js'

/**
 * The options that are available when instantiating a new Logger class.
 */
export interface ILoggerOptions {
  /** The format of the messages that are logged. */
  format?: OutputFormat

  /** A set of options that specify which colors to use for which levels. */
  colorOptions?: IColorOptions

  /**
   * The {@link LogTransport transport(s)} which specify the where to send log data.
   *
   * Default: {@link LogTransport.Console}
   */
  transports?: LogTransport | LogTransport[]

  /** The ingestion key to use for sending logs to Mezmo/LogDNA. */
  mezmoKey?: string
}
