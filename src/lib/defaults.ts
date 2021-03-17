import { IColorOpts } from '../interfaces/IColorOpts'
import { LogFormat } from '../interfaces/LogFormat'

export const DefaultColors: IColorOpts = {
  debug: 'cyan',
  error: 'red',
  info: 'gray',
  success: 'green',
  warn: 'yellow'
}

export const DefaultFormat: LogFormat = 'plaintext'
