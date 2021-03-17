import { IColorOpts, LogFormat } from '.'

export interface ILoggerOpts {
  /** The format of the messages that are logged. */
  format?: LogFormat

  /** A set of options that specify which colors to use for which levels. */
  colorOpts?: IColorOpts

  /** 
   * An optional field that specifies where to store log files. If this property
   * is left empty, then no files are created and logging only goes to stdout.
   */
  logDir?: string
}