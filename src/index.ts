import chalk from 'chalk'
import { DefaultColors } from './defaults'
import { IColorOpts, ILogger, Level, LogFormat } from './interfaces'

export class Logger implements ILogger {
  // private _format: LogFormat
  private colors: IColorOpts = DefaultColors


  constructor(_format: LogFormat, colors?: IColorOpts) {
    if (colors) this.colors = colors
    // this._format = format
  }

  private colorMsg(msg: string, level: Level) {
    return chalk.keyword(this.colors[level])(msg)
  }

  // private formatMsg(msg: string, level: Level) {
  // }

  info(msg: string) {
    console.log(this.colorMsg(msg, Level.info))
  }

  warn(msg: string) {
    console.log(this.colorMsg(msg, Level.warn))
  }

  debug(msg: string) {
    console.log(this.colorMsg(msg, Level.debug))
  }

  error(msg: string | Error, ..._extra: any[]) {
    console.log(
      this.colorMsg(msg instanceof Error ? msg.message : msg, Level.error)
    )
    console.log(this.colorMsg(_extra.join('\n'), Level.error))
  }

  success(msg: string) {
    console.log(this.colorMsg(msg, Level.success))
  }

  log(msg: string, level: any) {
    console.log(this.colorMsg(msg, level))
  }
}
