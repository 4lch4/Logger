import { ITransportCollection, BuiltInTransports } from '@interfaces/index.js'

/** The default number of hyphens to use when printing a divider. */
export const DEFAULT_DIVIDER_WIDTH = 25

export const DEFAULT_BUILTIN_TRANSPORT: BuiltInTransports = 'console'

/** The default transport(s) used by the standard exported Logger. */
export const DEFAULT_LOGGER_TRANSPORTS: ITransportCollection = {
  builtIn: [DEFAULT_BUILTIN_TRANSPORT],
}
