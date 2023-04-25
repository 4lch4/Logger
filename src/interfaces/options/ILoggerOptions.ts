import { BaseTransport } from '@bases/index.js'
import { IOutputOptions } from '@interfaces/index.js'

/**
 * The options that are available when instantiating a new Logger class.
 */
export interface ILoggerOptions {
  /** An optional object containing all the settings related to how log entries are output. */
  outputOptions?: IOutputOptions

  /** The ingestion key to use for sending logs to Mezmo/LogDNA. */
  mezmoKey?: string

  /**
   * An array of all the Transports for where log data should be sent. At least one must be provided
   * for the library to work.
   */
  transports: BaseTransport[]
}
