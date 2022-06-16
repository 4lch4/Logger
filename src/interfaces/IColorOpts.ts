import { Color } from 'chalk'
import { Level } from './index.js'

/** The options for the color of each log level. */
export interface IColorOpts {
  [Level.debug]: typeof Color
  [Level.error]: typeof Color
  [Level.info]: typeof Color
  [Level.success]: typeof Color
  [Level.warn]: typeof Color
}

/**
 * The options for the color of each log level. All parameters are optional and
 * any level that isn't provided will use the default color. For details on the
 * default colors, see the exported `DefaultColors` object.
 */
export interface IColorOptsInput {
  [Level.debug]?: string | typeof Color
  [Level.error]?: string | typeof Color
  [Level.info]?: string | typeof Color
  [Level.success]?: string | typeof Color
  [Level.warn]?: string | typeof Color
}
