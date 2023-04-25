// import LogDNA from '@logdna/logger'
// import { IInspectOptions, ILoggerOptions, LogLevel } from './interfaces/index.js'
// import {
//   DEFAULT_COLORS,
//   DEFAULT_DIVIDER_WIDTH,
//   DEFAULT_LOGGER_OPTIONS,
//   DEFAULT_LOG_FORMAT,
//   FormatUtil,
// } from './lib/index.js'

//#region Logger Exports
/**
 * This class is the main/only class of the library. It contains the various
 * methods to log messages, and the options provided (if any) are passed to the
 * formatter class for modifying the output.
 *
 * Each method uses the `console` module behind the scenes. This means that you
 * can provide the ...optionalParams to all methods and they will be passed to
 * the console module.
 */
// export class Logger {
//   private formatter: FormatUtil
//   private mezmo?: LogDNA.Logger

//   /**
//    * The sole constructor available for the `Logger` class. It takes an optional
//    * `ILoggerOpts` object which can be used to modify the output of the logger.
//    * If no options are provided, the default options are used.
//    *
//    * @param opts An optional object containing the options for the logger.
//    */
//   public constructor(opts?: ILoggerOptions) {
//     let colorOpts = DEFAULT_COLORS
//     let formatOpt = DEFAULT_LOG_FORMAT

//     if (opts?.format) formatOpt = opts.format
//     if (opts?.colorOptions) colorOpts = opts.colorOptions

//     this.formatter = new FormatUtil(formatOpt, colorOpts)
//     if (opts?.mezmoKey) this.mezmo = LogDNA.setupDefaultLogger(opts?.mezmoKey, {})
//   }

//   /**
//    * The internal logging function that is called by all the public functions.
//    *
//    * @param msg The message to log.
//    * @param level The log level to send the message to.
//    * @param optionalParams Any additional parameters to log.
//    */
//   private _log(msg: string | Object, level: LogLevel, ...optionalParams: any[]): void {
//     const msgOut = this.formatter.formatMsg(msg, level)

//     this.mezmo?.log(msgOut, { level: level, meta: optionalParams })

//     if (typeof msg === 'string') {
//       console.log(msgOut, optionalParams.length > 0 ? optionalParams : undefined)
//     } else {
//       console.log(
//         JSON.stringify(msgOut, null, 2),
//         optionalParams.length > 0 ? optionalParams : undefined
//       )
//     }
//   }

//   /**
//    * Writes the given message to `stdout` with a new line.
//    *
//    * @param msg The content to write to `stdout`.
//    * @param optionalParams Any extra parameters to pass to the console module.
//    */
//   public info(msg: string | Object, ...optionalParams: any[]): void {
//     this._log(msg, LogLevel.info, optionalParams)
//   }

//   /**
//    * Writes the given message to `stdout` with a new line and colors it yellow
//    * to indicate it is a warning.
//    *
//    * @param msg The content to write to `stdout`.
//    * @param optionalParams Any extra parameters to pass to the console module.
//    */
//   public warn(msg: string | Object, ...optionalParams: any[]): void {
//     this._log(msg, LogLevel.warn, optionalParams)
//   }

//   /**
//    * Writes the given message to the console at the debug level as long as the
//    * `DEBUG` environment variable is set to `true`.
//    *
//    * @param msg The string/object to write to the debug channel of the console
//    * @param optionalParams Any extra parameters to pass to the console module.
//    */
//   public debug(msg: string | Object, ...optionalParams: any[]): void {
//     if (process.env.DEBUG) {
//       this._log(msg, LogLevel.debug, ...optionalParams)
//     }
//   }

//   /**
//    * Writes the given content to `stderr`. If the content is an object, it will
//    * be stringified and written to `stderr`. If the content is a string, it will
//    * be written to `stderr` as is. If the content is `unknown`, it will attempt
//    * to be written to `stderr` as an Object.
//    *
//    * Lastly, if there are any optionalParams provided they are joined with a new
//    * line and written to `stderr`.
//    *
//    * @param msg The content to write to `stderr`.
//    * @param optionalParams Any extra parameters to pass to the console module.
//    */
//   public error(msg: string | Error | unknown, ...optionalParams: any[]): void {
//     if (msg instanceof Error) {
//       if (optionalParams.length > 0) {
//         console.error(this.formatter.formatMsg(msg.message, LogLevel.error), optionalParams)
//       } else console.error(this.formatter.formatMsg(msg.message, LogLevel.error))
//     } else if (typeof msg === 'string') {
//       if (optionalParams.length > 0) {
//         console.error(this.formatter.formatMsg(msg, LogLevel.error), optionalParams)
//       } else console.error(this.formatter.formatMsg(msg, LogLevel.error))
//     } else {
//       if (optionalParams.length > 0) {
//         console.error(this.formatter.formatMsg(JSON.stringify(msg), LogLevel.error), optionalParams)
//       } else {
//         console.error(this.formatter.formatMsg(JSON.stringify(msg), LogLevel.error))
//       }
//     }
//   }

//   /**
//    * Writes the given message to `stdout` with a new line and colors it green
//    * to indicate a successful operation.
//    *
//    * @param msg The content to write to `stdout`.
//    * @param optionalParams Any extra parameters to pass to the console module.
//    */
//   public success(msg: string, ...optionalParams: any[]): void {
//     this._log(msg, LogLevel.success, optionalParams)
//   }

//   /**
//    * A convenience method for writing to any level of the console.
//    *
//    * @param msg The content to write.
//    * @param level The level of the message, such as DEBUG, INFO, WARN, ERROR, or SUCCESS.
//    * @param optionalParams Any extra parameters to pass to the console module.
//    */
//   public log(msg: string, level: any, ...optionalParams: any[]): void {
//     this._log(msg, level, optionalParams)
//   }

//   /** A convenience method for clearing the console. */
//   public clear(): void {
//     console.clear()
//   }

//   /**
//    * Maintains an internal counter specific to `label` and outputs to `stdout`
//    * the number of times `logger.count()` has been called with the given
//    * `label`.
//    *
//    * @param label The label associated with the counter.
//    *
//    * @example
//    * > logger.count()
//    * default: 1
//    * undefined
//    * > logger.count('default')
//    * default: 2
//    * undefined
//    * > logger.count('abc')
//    * abc: 1
//    * undefined
//    * > logger.count('xyz')
//    * xyz: 1
//    * undefined
//    * > logger.count('abc')
//    * abc: 2
//    * undefined
//    * > logger.count()
//    * default: 3
//    * undefined
//    */
//   public count(label?: string): void {
//     return console.count(label)
//   }

//   /**
//    * Resets the internal counter specific to the provided `label` parameter.
//    *
//    * @param label The label associated with the counter.
//    *
//    * @example
//    * > console.count('abc');
//    * abc: 1
//    * undefined
//    * > console.countReset('abc');
//    * undefined
//    * > console.count('abc');
//    * abc: 1
//    * undefined
//    */
//   public countReset(label?: string): void {
//     return console.countReset(label)
//   }

//   /**
//    * Try to construct a table with the columns of the properties of
//    * `tabularData` (or use `properties`) and rows of `tabularData` and log it.
//    * Falls back to just logging the argument if it can’t be parsed as tabular.
//    *
//    * @param tabularData The data to output to `stdout`.
//    * @param properties The properties to display in the table.
//    *
//    * @returns Nothing.
//    *
//    * @example
//    * // These can't be parsed as tabular data
//    * console.table(Symbol());
//    * // Symbol()
//    *
//    * console.table(undefined);
//    * // undefined
//    *
//    * console.table([{ a: 1, b: 'Y' }, { a: 'Z', b: 2 }]);
//    * // ┌─────────┬─────┬─────┐
//    * // │ (index) │  a  │  b  │
//    * // ├─────────┼─────┼─────┤
//    * // │    0    │  1  │ 'Y' │
//    * // │    1    │ 'Z' │  2  │
//    * // └─────────┴─────┴─────┘
//    *
//    * console.table([{ a: 1, b: 'Y' }, { a: 'Z', b: 2 }], ['a']);
//    * // ┌─────────┬─────┐
//    * // │ (index) │  a  │
//    * // ├─────────┼─────┤
//    * // │    0    │  1  │
//    * // │    1    │ 'Z' │
//    * // └─────────┴─────┘
//    */
//   public table(tabularData: any[], properties?: string[]): void {
//     return console.table(tabularData, properties)
//   }

//   /**
//    * Uses `util.inspect()` on `obj` and prints the resulting string to `stdout`.
//    * This function bypasses any custom `inspect()` function defined on `obj`.
//    *
//    * @param object The object to inspect and output to `stdout`.
//    * @param options An optional object that contains options to be passed to `util.inspect`.
//    */
//   public dir(object: any, options?: IInspectOptions): void {
//     return console.dir(object, options)
//   }

//   /**
//    * Increases indentation of subsequent lines by spaces for
//    * `groupIndentationlength`.
//    *
//    * If one or more `label`s are provided, those are printed first without the
//    * additional indentation.
//    *
//    * @param label The label(s) to use for the grouping.
//    */
//   public group(...label: any[]): void {
//     return console.group(...label)
//   }

//   /**
//    * Decreases indentation of subsequent lines by spaces for
//    * `groupIndentationlength`.
//    */
//   public groupEnd(): void {
//     return console.groupEnd()
//   }

//   /**
//    * Starts a timer that can be used to compute the duration of an operation.
//    * Timers are identified by a unique `label`. Use the same `label` when
//    * calling `timeEnd` to stop the timer and output the elapsed time in suitable
//    * time units to `stdout`. For example, if the elapsed time is 3869ms,
//    * `logger.timeEnd()` displays "3.869s".
//    */
//   public time(label?: string | undefined): void {
//     return console.time(label)
//   }

//   /**
//    * Stops a timer that was previously started by calling time and prints the
//    * result to `stdout` like the following example:
//    *
//    * @example
//    * ```
//    * logger.time('100-elements');
//    * for (let i = 0; i < 100; i++) {}
//    * logger.timeEnd('100-elements');
//    * // prints 100-elements: 225.438ms
//    * ```
//    */
//   public timeEnd(label?: string | undefined): void {
//     return console.timeEnd(label)
//   }

//   /**
//    * For a timer that was previously started by calling `time`, prints the
//    * elapsed time and other `data` arguments to `stdout`:
//    *
//    * @example
//    * console.time('process');
//    * const value = expensiveProcess1(); // Returns 42
//    * console.timeLog('process', value);
//    *
//    * // Prints "process: 365.227ms 42".
//    * doExpensiveProcess2(value);
//    * console.timeEnd('process');
//    */
//   public timeLog(label?: string | undefined, ...data: any[]): void {
//     return console.timeLog(label, data)
//   }

//   /**
//    * Prints to `stderr` the string `'Trace: '`, followed by the `util.format()`
//    * formatted message and stack trace to the current position in the code.
//    *
//    * @example
//    * console.trace('Show me');
//    * // Prints: (stack trace will vary based on where trace is called)
//    * //  Trace: Show me
//    * //    at repl:2:9
//    * //    at REPLServer.defaultEval (repl.js:248:27)
//    * //    at bound (domain.js:287:14)
//    * //    at REPLServer.runBound [as eval] (domain.js:300:12)
//    * //    at REPLServer.<anonymous> (repl.js:412:12)
//    * //    at emitOne (events.js:82:20)
//    * //    at REPLServer.emit (events.js:169:7)
//    * //    at REPLServer.Interface._onLine (readline.js:210:10)
//    * //    at REPLServer.Interface._line (readline.js:549:8)
//    * //    at REPLServer.Interface._ttyWrite (readline.js:826:14)
//    */
//   public trace(message?: any, ...optionalParams: any[]): void {
//     return console.trace(message, optionalParams)
//   }

//   /**
//    * Prints a divider (made up of hyphens by default) to `stdout` to visually
//    * separate sections of output.
//    *
//    * @param length The length (amount of characters used) of the divider.
//    */
//   public divider(length: number = DEFAULT_DIVIDER_WIDTH, char: string = '-'): void {
//     return console.log(char.repeat(length))
//   }
// }
import { Logger, DEFAULT_LOGGER_OPTIONS } from './lib/index.js'

/**
 * A basic instance of the {@link Logger} class using some sane defaults for the
 * config options. For more information regarding the default options, refer to
 * the {@link DEFAULT_LOGGER_OPTIONS} object.
 */
export const logger = new Logger(DEFAULT_LOGGER_OPTIONS)

export default Logger
//#endregion Logger Exports

//#region Extra/Utility Exports
export * as Constants from '@constants/index.js'
export * as Defaults from '@defaults/index.js'
export * as Interfaces from '@interfaces/index.js'
export * as Lib from '@lib/index.js'
//#endregion Extra/Utility Exports
