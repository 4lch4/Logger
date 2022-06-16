import { Color } from 'chalk'
import { Level } from './index.js'

export interface IColorOpts {
  [Level.debug]: typeof Color
  [Level.error]: typeof Color
  [Level.info]: typeof Color
  [Level.success]: typeof Color
  [Level.warn]: typeof Color
}
