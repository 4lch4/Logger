import { BaseTransport } from '@bases/index.js'
import { DEFAULT_LOGGER_OPTIONS } from '@defaults/index.js'
import { ILoggerInput, ILoggerOptions, LogLevel } from '@interfaces/index.js'
import { DateUtil } from '@utils/index.js'
import LogDNA from '@logdna/logger'

const testInput: ILoggerInput = {
  msg: '',
  level: LogLevel.info,
}

/**
 * This class is the _new_ version of the Logger class exported by the [@4lch4/logger][0] library,
 * with the following features:
 *
 * - Built-in Transports for deciding _where_ log data is to go.
 * - Support for building your own custom Transports.
 * - Out of the box support for Mezmo/LogDNA.
 * - Public functions for every method provided by the console module.
 *   - `console.table`, `console.group`, etc.
 *
 *
 * It supports built-in (and custom) Transport classes,
 *
 * [0]: https://www.npmjs.com/package/@4lch4/logger
 */
export class Logger {
  private mezmo?: LogDNA.Logger
  private transports: BaseTransport[] = []
  private dateUtil: DateUtil = new DateUtil()

  public constructor(private options: ILoggerOptions) {
    this.options = {
      ...DEFAULT_LOGGER_OPTIONS,
      ...options,
    }

    if (options.mezmoKey) this.mezmo = LogDNA.setupDefaultLogger(options.mezmoKey)
  }

  private send(data: ILoggerInput, transport: BaseTransport): void {
    transport.send(data)
  }

  private sendStr(data: string) {
    const msg: string[] = []
    if (this.options.outputOptions?.timestamp) msg.push(`[]`)
    console.log(``)
  }

  public info(data: string | ILoggerInput): void {
    if (typeof data === 'string') {
      console.log(``)
    }
  }

  public fail(data: string | ILoggerInput): void {
    for (const transport of this.options.transports) {
      if (typeof data === 'string') transport.send({ msg: data, level: LogLevel.fail })
      else transport.send(data)
    }
  }

  public warn(data: string | ILoggerInput): void {
    for (const transport of this.options.transports) {
      if (typeof data === 'string') transport.send({ msg: data, level: LogLevel.warn })
      else transport.send(data)
    }
  }

  public debug(data: string | ILoggerInput): void {
    for (const transport of this.options.transports) {
      if (typeof data === 'string') transport.send({ msg: data, level: LogLevel.debug })
      else transport.send(data)
    }
  }

  public error(data: string | ILoggerInput): void {
    for (const transport of this.options.transports) {
      if (typeof data === 'string') transport.send({ msg: data, level: LogLevel.error })
      else transport.send(data)
    }
  }

  public success(data: string | ILoggerInput) {
    for (const transport of this.options.transports) {
      if (typeof data === 'string') transport.send({ msg: data, level: LogLevel.success })
      else transport.send(data)
    }
  }
}
