import { ConsoleTransport, Logger } from '@lib/index.js'
import { OutputFormat } from '@interfaces/index.js'

/**
 * This interface represents the base options object that is provided to the constructor of a
 * Transport class. It can be extended upon to create new versions for different classes.
 */
export interface ITransportOptions {
  /**
   * An optional name of this Transport, used as additional logging data.
   *
   * NOTE: If no value is provided then it will be set to the type of Transport used. For example,
   * if using the {@link ConsoleTransport} then the name will default to `console`.
   */
  name?: string

  /** An optional description of the Transport. */
  description?: string

  /**
   * An optional boolean to indicate whether or not a timestamp should be appended to the start of
   * all log messages/data sent via this Transport. This value _will override_ the global
   * `outputOptions.timestamp` property provided when instantiating the Logger class.
   *
   * _NOTE: The default value of this property will be the same as the `outputOptions.timestamp`
   * property provided when instantiating the {@link Logger} class._
   */
  timestamp?: boolean

  /**
   * An optional property that determines what format log data should be output in.
   */
  format?: OutputFormat
}
