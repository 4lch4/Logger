import { IOutputOptions, ITransportCollection } from '@interfaces/index.js'

/**
 * The options that are available when instantiating a new Logger class.
 */
export interface ILoggerOptions {
  /** An optional object containing all the settings related to how log entries are output. */
  outputOptions?: IOutputOptions

  /** The ingestion key to use for sending logs to Mezmo/LogDNA. */
  mezmoKey?: string

  /** An optional object containing the Transport related settings. */
  transports?: ITransportCollection
}
