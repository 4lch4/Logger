import { ILoggerOptions } from '@interfaces/index.js'
import { MezmoUtil } from '@utils/MezmoUtil.js'
import { DEFAULT_COLORS, DEFAULT_LOGGER_TRANSPORTS, DEFAULT_LOG_FORMAT } from '../../index.js'

/** The default options to use for the logger. */
export const DEFAULT_LOGGER_OPTIONS: ILoggerOptions = {
  /** An object containing the default colors to use for each logging level. */
  colorOptions: DEFAULT_COLORS,

  /** The default format to use for logging. */
  outputFormat: DEFAULT_LOG_FORMAT,

  /** The default value to use for the Mezmo/LogDNA ingestion token/API key. */
  mezmoKey: MezmoUtil.getMezmoToken(),

  /** The default LogTransport to use. */
  transports: DEFAULT_LOGGER_TRANSPORTS,
}
