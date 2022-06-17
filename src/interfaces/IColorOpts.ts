/*
 * —————————————————————————————————————————————————————————————————————————————
 * Project Name			— Logger
 * Project Version	— 1.8.1
 * Project Desc.		— An API for easily generating a new project or individual components.
 * Author						— Devin W. Leaman (4lch4)
 * Company					— 4lch4 Industries, LLC.
 * —————————————————————————————————————————————————————————————————————————————
 * File Path				— /src/interfaces/IColorOpts.ts
 * File Created			— 2021-10-07 @ 13:12:22-05:00
 * Last Modified		— 2022-06-17 @ 01:23:56-05:00
 * Modified By			— Devin W. Leaman (4lch4) (hey@4lch4.email)
 * —————————————————————————————————————————————————————————————————————————————
 * MIT License ⸺ http://www.opensource.org/licenses/MIT
 * 
 * Copyright (c) 2022, Devin W. Leaman (4lch4) (hey@4lch4.email)
 * —————————————————————————————————————————————————————————————————————————————
 */

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
