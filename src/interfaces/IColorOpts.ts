import { Color } from 'chalk'
import { Level } from './index.js'

/** The options for the color of each log level. */
export interface IColorOpts {
  [Level.debug]: Color
  [Level.error]: Color
  [Level.info]: Color
  [Level.success]: Color
  [Level.warn]: Color
}

/**
 * The options for the color of each log level. All parameters are optional and
 * any level that isn't provided will use the default color. For details on the
 * default colors, see the exported `DefaultColors` object.
 */
export interface IColorOptsInput {
  [Level.debug]?: string | Color
  [Level.error]?: string | Color
  [Level.info]?: string | Color
  [Level.success]?: string | Color
  [Level.warn]?: string | Color
}
