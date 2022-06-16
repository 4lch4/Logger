import { IColorOpts, LogFormat } from './index.js'

export interface ILoggerOpts {
  /** The format of the messages that are logged. */
  format?: LogFormat

  /** A set of options that specify which colors to use for which levels. */
  colorOpts?: IColorOpts
}
