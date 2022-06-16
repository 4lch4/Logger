import { IColorOpts, LogFormat } from '../interfaces/index.js'

export const DefaultColors: IColorOpts = {
  debug: 'cyan',
  error: 'red',
  info: 'gray',
  success: 'green',
  warn: 'yellow'
}

export const DefaultLogFormat: LogFormat = 'plaintext'

export const DefaultDayJSFormats = {
  prettyFormat: 'YYYY.MM.DD-HH:mm:ss',
  utcMillisecondsFormat: 'x'
}
