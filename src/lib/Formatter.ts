import chalk from 'chalk'
import dayjs from 'dayjs'
import AdvancedFormats from 'dayjs/plugin/advancedFormat.js'
import os from 'os'
import { IColorOptions, Level, LogFormat } from '../interfaces/index.js'
import { DefaultDayJSFormats } from './index.js'

/**
 * A utility class used for formatting messages.
 *
 * @class Formatter
 */
export class Formatter {
  format: LogFormat
  colors: IColorOptions

  /**
   * The constructor for the Formatter class. Both parameters are required for
   * the class to function. The `format` parameter is the format to use for
   * logging. The `colorOpts` parameter is an object containing the colors to
   * use for each level.
   *
   * @param format The format to use for logging messages.
   * @param colors An object that defines the colors to use for each level.
   */
  constructor(format: LogFormat, colors: IColorOptions) {
    this.colors = colors
    this.format = format

    dayjs.extend(AdvancedFormats)
  }

  /**
   * Colors a message based on the level of the message.
   *
   * @param msg The message to color.
   * @param level The level of the message.
   * @returns The given message colored for the given level.
   */
  colorMsg(msg: string, level: Level) {
    return chalk[this.colors[level]](msg)
  }

  private stringifyMsg(msg: string | Object): string {
    if (typeof msg === 'string') return msg
    return JSON.stringify(msg)
  }

  /**
   * Formats the given message for output based on the `format` parameter that
   * was provided when instantiating the class and the `level` parameter.
   *
   * @param msg The message to format.
   * @param level The level of the message.
   * @returns A formatted message to be logged.
   */
  formatMsg(msg: string | Object, level: Level) {
    if (this.format === 'json') {
      const logOutput = {
        /** The timestamp for when the message was sent. */
        time: this.getUTCTime(),
        host: os.hostname(),
        pid: process.pid,
        level,
        msg: this.stringifyMsg(msg)
      }

      return this.colorMsg(JSON.stringify(logOutput), level)
    } else {
      const output = [
        `[${this.getPrettyTime()}]`,
        `[${level.toUpperCase()}]`,
        this.stringifyMsg(msg)
      ]

      return this.colorMsg(output.join(' - '), level)
    }
  }

  /** Returns the time as UTC Milliseconds. */
  getUTCTime() {
    return dayjs().format(DefaultDayJSFormats.utcMillisecondsFormat)
  }

  /** Returns the current time using a pretty format: `YYYY.MM.DD-HH:mm:ss` */
  getPrettyTime() {
    return dayjs().format(DefaultDayJSFormats.prettyFormat)
  }
}
