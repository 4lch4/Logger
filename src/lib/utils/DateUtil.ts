import { DEFAULT_DAYJS_FORMATS } from '@defaults/index.js'
import dayjs from 'dayjs'

export class DateUtil {
  public getTimestamp(format: string = DEFAULT_DAYJS_FORMATS.logFormat, date?: string): string {
    return dayjs(date).format(format)
  }

  /** Returns the time as UTC Milliseconds. */
  getUTCTime() {
    return dayjs().format(DEFAULT_DAYJS_FORMATS.utcMillisecondsFormat)
  }

  /** Returns the current time using a pretty format: `YYYY.MM.DD-HH:mm:ss` */
  getPrettyTime() {
    return dayjs().format(DEFAULT_DAYJS_FORMATS.prettyFormat)
  }
}
