import { OutputFormat, IColorOptions } from '@interfaces/index.js'

export interface IOutputOptions {
  /** The format to use when outputting data (`json` or `plaintext`). */
  format?: OutputFormat

  /** A set of options that specify which colors to use for which {@link LogLevel}. */
  colors?: IColorOptions

  /**
   * An optional boolean indicating whether or not to append a timestamp to all log entries. If no
   * value is provided, the default of `true` is used.
   */
  timestamp?: boolean
}