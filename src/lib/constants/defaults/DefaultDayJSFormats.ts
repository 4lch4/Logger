export const DEFAULT_DAYJS_LOG_FORMAT: string = 'YYYYMMDDTHHmmss'

/** The standard pretty format: `YYYY.MM.DD-HH:mm:ss` */
export const DEFAULT_DAYJS_PRETTY_FORMAT: string = 'YYYY.MM.DD-HH:mm:ss'

/** For formatting the time as UTC Milliseconds. */
export const DEFAULT_DAYJS_UTC_MS_FORMAT: string = 'x'

/** The default formatting options to use w/ DayJS. */
export const DEFAULT_DAYJS_FORMATS = {
  prettyFormat: DEFAULT_DAYJS_PRETTY_FORMAT,

  logFormat: DEFAULT_DAYJS_LOG_FORMAT,

  utcMillisecondsFormat: DEFAULT_DAYJS_UTC_MS_FORMAT,
}
