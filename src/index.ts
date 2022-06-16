import { ILoggerOpts, Level } from './interfaces'
import { DefaultColors, DefaultLogFormat, Formatter } from './lib'

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
    console.log(this.formatter.formatMsg(msg, Level.info), optionalParams)
  }

  /**
   * Writes the given message to `stdout` with a new line and colors it yellow
   * to indicate it is a warning.
   *
   * @param msg The content to write to `stdout`.
   * @param optionalParams Any extra parameters to pass to the console module.
   */
  warn(msg: string | Object, ...optionalParams: any[]): void {
    console.log(this.formatter.formatMsg(msg, Level.warn), optionalParams)
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
      console.log(this.formatter.formatMsg(msg, Level.debug), optionalParams)
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
      console.error(this.formatter.formatMsg(msg.message, Level.error))
    } else if (msg instanceof String) {
      console.error(this.formatter.formatMsg(msg, Level.error))
    } else {
      console.error(this.formatter.formatMsg(msg as Object, Level.error))
    }

    if (optionalParams.length > 0) {
      console.error(
        this.formatter.formatMsg(optionalParams.join('\n'), Level.error)
      )
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
    console.log(this.formatter.formatMsg(msg, Level.success), optionalParams)
  }

  /**
   * A convenience method for writing to any level of the console.
   *
   * @param msg The content to write.
   * @param level The level of the message, such as DEBUG, INFO, WARN, ERROR, or SUCCESS.
   * @param optionalParams Any extra parameters to pass to the console module.
   */
  log(msg: string, level: any, ...optionalParams: any[]): void {
    console.log(this.formatter.formatMsg(msg, level), optionalParams)
  }
}

/**
 * A basic instance of the {@link Logger} class using some sane defaults for the
 * config options.
 */
export const logger = new Logger()
