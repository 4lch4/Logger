import Mezmo from '@logdna/logger'
import OS from 'os'
import { DEFAULT_MEZMO_TAGS } from '@lib/index.js'

/**
 * An object containing the default options to use when instantiating the
 * LogDNA logger class. Only to be used when the user does not provide any
 * options.
 */
export const DEFAULT_MEZMO_OPTIONS: Mezmo.ConstructorOptions = {
  app: module.id,

  /** The hostname of the device sending the log message. */
  hostname: OS.hostname(),

  /** An array of tags to attach to each log message. */
  tags: DEFAULT_MEZMO_TAGS,

  /** Not sure I'll actually use this... We'll see. */
  meta: {},
}
