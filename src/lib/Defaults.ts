import { IColorOptions, LogFormat } from '../interfaces/index.js'

/** An object containing the default colors to use for each logging level. */
export const DEFAULT_COLORS: IColorOptions = {
  debug: 'cyan',
  error: 'red',
  info: 'gray',
  success: 'green',
  warn: 'yellow'
}

/** The default format to use for logging. */
export const DEFAULT_LOG_FORMAT: LogFormat = 'plaintext'

/** The default formatting options to use w/ DayJS. */
export const DEFAULT_DAYJS_FORMATS = {
  /** The standard pretty format: `YYYY.MM.DD-HH:mm:ss` */
  prettyFormat: 'YYYY.MM.DD-HH:mm:ss',

  /** For formatting the time as UTC Milliseconds. */
  utcMillisecondsFormat: 'x'
}

/** The default options to use for the logger. */
export const DEFAULT_LOGGER_OPTIONS = {
  /** An object containing the default colors to use for each logging level. */
  colorOpts: DEFAULT_COLORS,

  /** The default format to use for logging. */
  format: DEFAULT_LOG_FORMAT
}

/** The default number of hyphens to use when printing a divider. */
export const DEFAULT_COLUMN_WIDTH = 25
