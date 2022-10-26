import Mezmo from '@logdna/logger'
import OS from 'os'
import { DailyRotateFileTransportOptions } from 'winston-daily-rotate-file'

/**
 * An array of strings to use as the default tags for the logger, should none be
 * provided by the user.
 */
export const LOGDNA_TAGS: string[] = [
  '@4lch4/logger',
  'nodejs',
  'typescript',
  `OSPlatform:${OS.platform()}`,
  `OSType:${OS.type()}`
]

/**
 * An object containing the default options to use when instantiating the
 * LogDNA logger class. Only to be used when the user does not provide any
 * options.
 */
export const LOGDNA_CONSTRUCTOR_OPTIONS: Mezmo.ConstructorOptions = {
  app: module.id,

  /** The hostname of the device sending the log message. */
  hostname: OS.hostname(),

  /** An array of tags to attach to each log message. */
  tags: LOGDNA_TAGS,

  /** Not sure I'll actually use this... We'll see. */
  meta: {}
}

export const DAILY_ROTATE_TRANSPORT_OPTIONS: DailyRotateFileTransportOptions = {
  auditFile: 'logger-audit.json',
  utc: true,
  extension: 'log'
}

export const CONSOLE_TRANSPORT_OPTIONS = { eol: '\n' }
