import { ILogger, ILoggerOpts, Level } from './interfaces'
import { DefaultColors, DefaultLogFormat, Formatter } from './lib'
import { IOUtil } from './lib/IOUtil'

export class Logger implements ILogger {
  private formatter: Formatter
  private ioUtil?: IOUtil

  constructor(loggerOpts?: ILoggerOpts) {
    let colorOpts = DefaultColors
    let formatOpt = DefaultLogFormat

    if (loggerOpts?.format) formatOpt = loggerOpts.format
    if (loggerOpts?.colorOpts) colorOpts = loggerOpts.colorOpts
    if (loggerOpts?.logDir) {
      this.ioUtil = new IOUtil(loggerOpts.logDir, loggerOpts.format)
    }

    this.formatter = new Formatter(formatOpt, colorOpts)
  }

  info(msg: string) {
    console.log(this.formatter.formatMsg(msg, Level.info))

    if (this.ioUtil) this.ioUtil.writeToLog(msg, Level.info)
  }

  warn(msg: string) {
    console.log(this.formatter.formatMsg(msg, Level.warn))

    if (this.ioUtil) this.ioUtil.writeToLog(msg, Level.warn)
  }

  debug(msg: string) {
    console.log(this.formatter.formatMsg(msg, Level.debug))

    if (this.ioUtil) this.ioUtil.writeToLog(msg, Level.debug)
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

    if (this.ioUtil) {
      if (msg instanceof Error) this.ioUtil.writeToLog(msg.message, Level.error)
      else this.ioUtil.writeToLog(msg, Level.error)

      if (extra.length > 0) {
        this.ioUtil.writeToLog(extra.join('\n'), Level.error)
      }
    }
  }

  success(msg: string) {
    console.log(this.formatter.formatMsg(msg, Level.success))

    if (this.ioUtil) this.ioUtil.writeToLog(msg, Level.success)
  }

  log(msg: string, level: any) {
    console.log(this.formatter.formatMsg(msg, level))

    if (this.ioUtil) this.ioUtil.writeToLog(msg, level)
  }
}

export const logger = new Logger()
