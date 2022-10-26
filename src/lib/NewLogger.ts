// @ts-ignore
import LogDNAWinston from 'logdna-winston'
import Winston, { transports } from 'winston'
import DailyRotate from 'winston-daily-rotate-file'
import { ILoggerOptions } from '../interfaces/index.js'
import { Defaults, LogDNA } from './index.js'

const tmp: Winston.Logform.TransformFunction = (
  info: Winston.Logform.TransformableInfo,
  opts?: any
) => {}

/**
 * This class is the new version of the {@link Logger} class that makes use of
 * Winston under the hood.
 */
export class NewLogger {
  private logger: Winston.Logger
  private logDna: LogDNA

  constructor(private opts?: ILoggerOptions) {
    this.logDna = LogDNA.init(opts?.logDNAKey)

    this.logger = Winston.createLogger({
      format: Winston.format.combine(
        Winston.format((info, opts) => {
          console.log(opts)

          return info
        })()
      ),
      transports: [
        new DailyRotate(Defaults.DAILY_ROTATE_TRANSPORT_OPTIONS),
        new transports.Console(Defaults.CONSOLE_TRANSPORT_OPTIONS),
        new LogDNAWinston({ key: opts?.logDNAKey })
      ]
    })
  }

  info(msg: string | Object) {}

  warn(msg: string | Object) {}

  error(msg: string | Object) {}

  success(msg: string | Object) {}

  fail(msg: string | Object) {}
}
