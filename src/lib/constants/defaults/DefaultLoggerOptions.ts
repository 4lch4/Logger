import { ILoggerOptions } from '@interfaces/index.js'
import {
  DEFAULT_COLOR_OPTIONS,
  DEFAULT_LOG_FORMAT,
  DEFAULT_LOG_TIMESTAMP,
  DEFAULT_LOGGER_TRANSPORTS,
} from '@lib/index.js'
import { MezmoUtil } from '@utils/MezmoUtil.js'

/** The default options to use for the logger. */
export const DEFAULT_LOGGER_OPTIONS: ILoggerOptions = {
  outputOptions: {
    /** An object containing the default colors to use for each logging level. */
    colors: DEFAULT_COLOR_OPTIONS,

    /** The default format to use for logging. */
    format: DEFAULT_LOG_FORMAT,

    /** A boolean indicating whether or not to add timestamps at the start of all log entries. */
    timestamp: DEFAULT_LOG_TIMESTAMP,
  },

  /** An object containing the default Transporters to use. */
  transports: DEFAULT_LOGGER_TRANSPORTS,

  /** The default value to use for the Mezmo/LogDNA ingestion token/API key. */
  mezmoKey: MezmoUtil.getMezmoToken(),
}
