import { IInspectOptions, ILoggerOpts, Level } from './interfaces/index.js'
import {
  DefaultColors,
  DefaultLogFormat,
  DefaultLoggerOpts,
  Formatter
} from './lib/index.js'

/**
 * This class is the main/only class of the library. It contains the various
 * methods to log messages, and the options provided (if any) are passed to the
 * formatter class for modifying the output.
 *
 * Each method uses the `console` module behind the scenes. This means that you
 * can provide the ...optionalParams to all methods and they will be passed to
 * the console module.
 *
 * @class Logger
 */
export class Logger {
  private formatter: Formatter

  /**
   * The sole constructor available for the `Logger` class. It takes an optional
   * `ILoggerOpts` object which can be used to modify the output of the logger.
   * If no options are provided, the default options are used.
   *
   * @param loggerOpts An optional object containing the options for the logger.
   */
  constructor(loggerOpts?: ILoggerOpts) {
    let colorOpts = DefaultColors
    let formatOpt = DefaultLogFormat

    if (loggerOpts?.format) formatOpt = loggerOpts.format
    if (loggerOpts?.colorOpts) colorOpts = loggerOpts.colorOpts

    this.formatter = new Formatter(formatOpt, colorOpts)
  }

  /**
   * Writes the given message to `stdout` with a new line.
   *
   * @param msg The content to write to `stdout`.
   * @param optionalParams Any extra parameters to pass to the console module.
   */
  info(msg: string | Object, ...optionalParams: any[]): void {
    if (optionalParams.length > 0) {
      console.log(this.formatter.formatMsg(msg, Level.info), optionalParams)
    } else console.log(this.formatter.formatMsg(msg, Level.info))
  }

  /**
   * Writes the given message to `stdout` with a new line and colors it yellow
   * to indicate it is a warning.
   *
   * @param msg The content to write to `stdout`.
   * @param optionalParams Any extra parameters to pass to the console module.
   */
  warn(msg: string | Object, ...optionalParams: any[]): void {
    if (optionalParams.length > 0) {
      console.warn(this.formatter.formatMsg(msg, Level.warn), optionalParams)
    } else console.warn(this.formatter.formatMsg(msg, Level.warn))
  }

  /**
   * Writes the given message to the console at the debug level as long as the
   * `DEBUG` environment variable is set to `true`.
   *
   * @param msg The string/object to write to the debug channel of the console
   * @param optionalParams Any extra parameters to pass to the console module.
   */
  debug(msg: string | Object, ...optionalParams: any[]): void {
    if (process.env.DEBUG) {
      if (optionalParams.length > 0) {
        console.log(this.formatter.formatMsg(msg, Level.debug), optionalParams)
      } else console.log(this.formatter.formatMsg(msg, Level.debug))
    }
  }

  /**
   * Writes the given content to `stderr`. If the content is an object, it will
   * be stringified and written to `stderr`. If the content is a string, it will
   * be written to `stderr` as is. If the content is `unknown`, it will attempt
   * to be written to `stderr` as an Object.
   *
   * Lastly, if there are any optionalParams provided they are joined with a new
   * line and written to `stderr`.
   *
   * @param msg The content to write to `stderr`.
   * @param optionalParams Any extra parameters to pass to the console module.
   */
  error(msg: string | Error | unknown, ...optionalParams: any[]): void {
    if (msg instanceof Error) {
      if (optionalParams.length > 0) {
        console.error(
          this.formatter.formatMsg(msg.message, Level.error),
          optionalParams
        )
      } else console.error(this.formatter.formatMsg(msg.message, Level.error))
    } else if (typeof msg === 'string') {
      if (optionalParams.length > 0) {
        console.error(
          this.formatter.formatMsg(msg, Level.error),
          optionalParams
        )
      } else console.error(this.formatter.formatMsg(msg, Level.error))
    } else {
      if (optionalParams.length > 0) {
        console.error(
          this.formatter.formatMsg(JSON.stringify(msg), Level.error),
          optionalParams
        )
      } else {
        console.error(
          this.formatter.formatMsg(JSON.stringify(msg), Level.error)
        )
      }
    }
  }

  /**
   * Writes the given message to `stdout` with a new line and colors it green
   * to indicate a successful operation.
   *
   * @param msg The content to write to `stdout`.
   * @param optionalParams Any extra parameters to pass to the console module.
   */
  success(msg: string, ...optionalParams: any[]): void {
    const msgOut = this.formatter.formatMsg(msg, Level.success)

    if (optionalParams.length > 0) console.log(msgOut, optionalParams)
    else console.log(msgOut)
  }

  /**
   * A convenience method for writing to any level of the console.
   *
   * @param msg The content to write.
   * @param level The level of the message, such as DEBUG, INFO, WARN, ERROR, or SUCCESS.
   * @param optionalParams Any extra parameters to pass to the console module.
   */
  log(msg: string, level: any, ...optionalParams: any[]): void {
    const msgOut = this.formatter.formatMsg(msg, level)

    if (optionalParams.length > 0) console.log(msgOut, optionalParams)
    else console.log(msgOut)
  }

}

/**
 * A basic instance of the {@link Logger} class using some sane defaults for the
 * config options.
 */
export const logger = new Logger()
