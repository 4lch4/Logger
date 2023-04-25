import { DEFAULT_COLOR_OPTIONS } from '@defaults/index.js'
import { ILoggerInput, IOutputOptions as IOptions, LogLevel } from '@interfaces/index.js'
import { DateUtil, FormatUtil } from '@utils/index.js'

export class SimpleLogger {
  private dUtil: DateUtil
  private fUtil: FormatUtil

  constructor(private logOpts: IOptions) {
    this.dUtil = new DateUtil()
    this.fUtil = new FormatUtil(logOpts.format || 'plaintext', {
      ...logOpts.colors,
      ...DEFAULT_COLOR_OPTIONS,
    })
  }
  
  private getMessagePrefix(level: LogLevel): string {
    // const prefix = this.logOpts.colors?.[level]?.prefix
    // return prefix ? prefix : ''
    const prefix: string[] = ['[']

    if (this.logOpts.timestamp) prefix.push(this.dUtil.getPrettyTime(), ']')

    prefix.push(`[${level.toUpperCase()}]`)

    // if (this.logOpts.timestamp) return `[${this.dUtil.getPrettyTime()}][${level.toUpperCase()}]`

    return prefix.join('')
  }

  /**
   * Returns true or false depending on whether the input is a string or not.
   *
   * @param data The input to be checked.
   *
   * @returns True if the input is a string, false otherwise.
   */
  private stringData(data: string | ILoggerInput): boolean {
    return typeof data === 'string'
  }

  private send(data: ILoggerInput): void {}

  private sendString(data: string, level: LogLevel = LogLevel.info): void {}

  public info(data: string | ILoggerInput): void {}

  public fail(data: string | ILoggerInput): void {}

  public warn(data: string | ILoggerInput): void {}

  public debug(data: string | ILoggerInput): void {}

  public error(data: string | ILoggerInput): void {}

  public success(data: string | ILoggerInput): void {
    const msg = []
  }

  public log(data: string | ILoggerInput, level: LogLevel): void {
    // if (this.stringData(data)) return this.send({ msg: data as string, level: level })
    // if (typeof data === 'string') return this.sendString(data, level)
    // if (typeof data === 'object') return this.send(data)

    // Use a ternary operator to determine whether the input is a string or not and call the appropriate method.
    return typeof data === 'string' ? this.sendString(data, level) : this.send(data)
  }
}
