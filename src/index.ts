import { IColorOpts, ILogger, Level, LogFormat } from './interfaces'
import { DefaultColors, DefaultLogFormat, Formatter } from './lib'

export class Logger implements ILogger {
  private formatter: Formatter

  constructor(format?: LogFormat, colors?: IColorOpts) {
    let colorOpts = DefaultColors
    let formatOpt = DefaultLogFormat

    if (colors) colorOpts = colors
    if (format) formatOpt = format

    this.formatter = new Formatter(formatOpt, colorOpts)
  }

  info(msg: string) {
    console.log(this.formatter.formatMsg(msg, Level.info))
  }

  warn(msg: string) {
    console.log(this.formatter.formatMsg(msg, Level.warn))
  }

  debug(msg: string) {
    console.log(this.formatter.formatMsg(msg, Level.debug))
  }

  error(msg: string | Error, ...extra: any[]) {
    if (msg instanceof Error) {
      console.log(this.formatter.formatMsg(msg.message, Level.error))
    } else {
      console.log(this.formatter.formatMsg(msg, Level.error))
    }

    if (extra.length > 0) {
      console.log(this.formatter.formatMsg(extra.join('\n'), Level.error))
    }
  }

  success(msg: string) {
    console.log(this.formatter.formatMsg(msg, Level.success))
  }

  log(msg: string, level: any) {
    console.log(this.formatter.formatMsg(msg, level))
  }
}
