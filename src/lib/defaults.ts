import { IColorOpts, LogFormat } from '../interfaces/index.js'

/** An object containing the default colors to use for each logging level. */
export const DefaultColors: IColorOpts = {
  debug: 'cyan',
  error: 'red',
  info: 'gray',
  success: 'green',
  warn: 'yellow'
}

/** The default format to use for logging. */
export const DefaultLogFormat: LogFormat = 'plaintext'

/** The default formatting options to use w/ DayJS. */
export const DefaultDayJSFormats = {
  /** The standard pretty format: `YYYY.MM.DD-HH:mm:ss` */
  prettyFormat: 'YYYY.MM.DD-HH:mm:ss',

  /** For formatting the time as UTC Milliseconds. */
  utcMillisecondsFormat: 'x'
}
