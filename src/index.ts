import Winston from 'winston'
import { LoggerConfig as DefaultLoggerConfig } from './Defaults.js'
import { ILoggerConfig } from './interfaces/index.js'

export class Logger {
  private logger: Winston.Logger

  constructor(loggerConfig?: ILoggerConfig) {
    this.logger = Winston.createLogger({ ...DefaultLoggerConfig, ...loggerConfig })
  }

  info(msg: string | Object, ...extra: any[]) {
    if (typeof msg === 'object') this.logger.info(JSON.stringify(msg, null, 2), ...extra)
    else this.logger.info(msg, ...extra)
  }

  warn(msg: string | Object, ...extra: any[]) {
    if (typeof msg === 'object') this.logger.info(JSON.stringify(msg, null, 2), ...extra)
    else this.logger.info(msg, ...extra)
  }

  debug(msg: string | Object, ...extra: any[]) {
    if (typeof msg === 'object') this.logger.info(JSON.stringify(msg, null, 2), ...extra)
    else this.logger.info(msg, ...extra)
  }

  error(msg: string | Error | unknown, ...extra: any[]) {
    switch (typeof msg) {
      case 'object':
        if (msg instanceof Error) this.logger.error(msg.message, [msg, ...extra])
        else this.logger.error(JSON.stringify(msg, null, 2), ...extra)
        break

      case 'string':
        this.logger.error(msg, ...extra)
        break

      default:
        this.logger.error(JSON.stringify(msg, null, 2), ...extra)
        break
    }
  }

  success(msg: string, ...extra: any[]) {
    if (typeof msg === 'object') this.logger.info(JSON.stringify(msg, null, 2), ...extra)
    else this.logger.info(msg, ...extra)
  }

  log(level: any, msg: string, ...extra: any[]) {
    return this.logger.log(level, msg, ...extra)
  }
}

export const logger = new Logger()
