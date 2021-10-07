import chalk from 'chalk'
import dayjs from 'dayjs'
import AdvancedFormats from 'dayjs/plugin/advancedFormat'
import { hostname } from 'os'
import { IColorOpts, Level } from '../interfaces'
import { LogFormat } from '../interfaces/LogFormat'
import { DefaultDayJSFormats } from './'

export class Formatter {
  format: LogFormat
  colors: IColorOpts

  constructor(format: LogFormat, colors: IColorOpts) {
    dayjs.extend(AdvancedFormats)

    this.colors = colors
    this.format = format
  }

  colorMsg(msg: string, level: Level) {
    return chalk.keyword(this.colors[level])(msg)
  }

  formatMsg(msg: string | Object, level: Level) {
    switch (typeof msg) {
      case 'string': {
        if (this.format === 'json') {
          const logOutput = {
            /** The timestamp for when the message was sent. */
            time: this.getUTCTime(),
            host: hostname(),
            pid: process.pid,
            level,
            msg
          }

          return this.colorMsg(JSON.stringify(logOutput), level)
        } else {
          const output = [
            `[${this.getPrettyTime()}]`,
            `[${level.toUpperCase()}]`,
            msg
          ]
          return this.colorMsg(output.join(' - '), level)
        }
      }
      case 'object':
        return this.colorMsg(JSON.stringify(msg), level)
    }
  }

  getUTCTime() {
    return dayjs().format(DefaultDayJSFormats.utcMillisecondsFormat)
  }

  getPrettyTime() {
    return dayjs().format(DefaultDayJSFormats.prettyFormat)
  }
}
