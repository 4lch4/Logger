import { WinstonTransport } from '@axiomhq/winston'
import {
  DEFAULT_LOG_HOSTNAME,
  DEFAULT_LOG_LEVEL,
  DEFAULT_LOG_NODE_ENV,
  DEFAULT_LOG_SERVICE,
} from './Defaults.js'
import { arch, platform } from 'node:os'
import Winston, {
  LeveledLogMethod,
  Logger as WinstonLogger,
  transports as WinstonTransports,
} from 'winston'

/**
 * A Winston Transport that logs to console, with colors for success and info.
 */
export const ConsoleTransport = new WinstonTransports.Console({
  format: Winston.format.combine(
    Winston.format.colorize({ colors: { success: 'green', info: 'cyan' } }),
    Winston.format.simple()
  ),
})

/**
 * Creates a new Winston transport that logs to Axiom using the given dataset, token, and org ID,
 * and returns it.
 *
 * @param dataset The Axiom Dataset to log to.
 * @param token The Axiom Token to use for authentication.
 * @param orgId The Axiom Org ID to use. Only required when the token is a personal token.
 *
 * @returns A new Winston transport that logs to Axiom.
 */
export function AxiomTransport(dataset: string, token: string, orgId?: string) {
  return new WinstonTransport({ dataset, token, orgId })
}

// Initialize the transports array with the console transport.
const transports: Winston.transport[] = [ConsoleTransport]

const AxiomDataSet = process.env.AXIOM_DATASET
const AxiomOrgId = process.env.AXIOM_ORG_ID
const AxiomToken = process.env.AXIOM_TOKEN

// Ensure that we only log to Axiom if the required environment variables are set.
if (AxiomDataSet && AxiomToken) {
  transports.push(AxiomTransport(AxiomDataSet, AxiomToken, AxiomOrgId))
}

/**
 * The level to log at. `LOG_LEVEL` takes precedence, otherwise `info` is used in production and
 * `debug` everywhere else.
 */
const logLevel =
  process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? DEFAULT_LOG_LEVEL : 'debug')

/**
 * An interface for the logger that extends the Winston logger and adds a `success` method.
 */
export interface Logger extends WinstonLogger {
  success: LeveledLogMethod
}

/**
 * A Winston logger that handles logging how I, _@4lch4_, prefer it be handled. It logs to the
 * console and to Axiom if the required environment variables are set.
 */
export const logger: Logger = Winston.createLogger({
  defaultMeta: {
    service:
      process.env.LOG_SERVICE ||
      process.env.API_NAME ||
      process.env.APP_NAME ||
      DEFAULT_LOG_SERVICE,
    nodeEnv: process.env.NODE_ENV || DEFAULT_LOG_NODE_ENV,
    hostname: process.env.HOSTNAME || DEFAULT_LOG_HOSTNAME,
    arch: arch(),
    platform: platform(),
  },
  level: logLevel,
  levels: { ...Winston.config.npm.levels, success: -1 },
  transports,
}) as Logger

logger.success = logger.log.bind(logger, 'success')
