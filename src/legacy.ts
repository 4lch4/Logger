import { cyan, gray, green, red, yellow } from 'chalk'
import dayjs from 'dayjs'
import { ILogger, Level } from './interfaces'

const formatMsg = (msg: string, level: Level) => {
  const timestamp = dayjs().format('YYYY.MM.DD-HH.mm.ss')
  const prefix = []

  switch (level) {
    case 'info': {
      prefix.push(gray(`[${timestamp}] - [INFO] - `))
      break
    }

    case 'warn': {
      prefix.push(yellow(`[${timestamp}] - [WARN] - `))
      break
    }

    case 'debug': {
      prefix.push(cyan(`[${timestamp}] - [DEBUG] - `))
      break
    }

    case 'error': {
      prefix.push(red(`[${timestamp}] - [ERROR] - `))
      break
    }

    case 'success': {
      prefix.push(green(`[${timestamp}] - [SUCCESS] - `))
      break
    }

    default: {
      return undefined
    }
  }

  prefix.push(msg)
  return prefix.join('')
}

export const logger: ILogger = {
  info: (msg: string) => console.log(formatMsg(msg, Level.info)),
  warn: (msg: string) => console.log(formatMsg(msg, Level.warn)),
  debug: (msg: string) => console.log(formatMsg(msg, Level.debug)),
  error: (msg: string | Error, ..._extra: any[]) => {
    console.log(red(msg instanceof Error ? msg.message : msg))
    console.log(red(_extra.join('\n')))
  },
  success: (msg: string) => console.log(formatMsg(msg, Level.success)),
  log: (msg: string, level: Level) => console.log(formatMsg(msg, level))
}
