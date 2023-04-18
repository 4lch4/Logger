import { ColorName } from 'chalk'
import { LogLevel } from '../index.js'

/** The options for the color of each log level. */
export interface IColorOptions {
  [LogLevel.info]: ColorName
  [LogLevel.fail]: ColorName
  [LogLevel.warn]: ColorName
  [LogLevel.debug]: ColorName
  [LogLevel.error]: ColorName
  [LogLevel.success]: ColorName
}

/**
 * The options for the color of each log level. All parameters are optional and
 * any level that isn't provided will use the default color. For details on the
 * default colors, see the exported `DefaultColors` object.
 */
export interface IColorOptionsInput {
  [LogLevel.info]?: ColorName | string
  [LogLevel.fail]?: ColorName | string
  [LogLevel.warn]?: ColorName | string
  [LogLevel.debug]?: ColorName | string
  [LogLevel.error]?: ColorName | string
  [LogLevel.success]?: ColorName | string
}
