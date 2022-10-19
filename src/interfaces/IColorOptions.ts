import { ColorName } from 'chalk'
import { Level } from './index.js'

/** The options for the color of each log level. */
export interface IColorOptions {
  [Level.debug]: ColorName
  [Level.error]: ColorName
  [Level.info]: ColorName
  [Level.success]: ColorName
  [Level.warn]: ColorName
}

/**
 * The options for the color of each log level. All parameters are optional and
 * any level that isn't provided will use the default color. For details on the
 * default colors, see the exported `DefaultColors` object.
 */
export interface IColorOptionsInput {
  [Level.debug]?: string | ColorName
  [Level.error]?: string | ColorName
  [Level.info]?: string | ColorName
  [Level.success]?: string | ColorName
  [Level.warn]?: string | ColorName
}
