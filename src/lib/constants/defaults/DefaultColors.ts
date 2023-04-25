import { IColorOptions } from '@interfaces/index.js'

/** The default colors used, by the pre-built logger, for each logging level. */
export const DEFAULT_COLOR_OPTIONS: IColorOptions = {
  debug: 'cyan',
  error: 'red',
  info: 'gray',
  success: 'green',
  warn: 'yellow',
  fail: 'magenta',
}
