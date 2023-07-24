import { WinstonTransport as AxiomTransport } from '@axiomhq/axiom-node'
import Winston, { transports as WinstonTransports } from 'winston'
import { ILoggerConfig } from './interfaces/index.js'

export const LoggerConfig: ILoggerConfig = {
  defaultFormat: Winston.format.json(),
  defaultMeta: {
    service: process.env.APP_NAME || process.env.API_NAME || '@4lch4/logger',
    version: process.env.APP_VERSION || process.env.API_VERSION || '0.0.0',
    hostname: process.env.HOSTNAME || 'localhost',
  },
  defaultLevel: 'info',
  defaultTransports: [
    new AxiomTransport({
      dataset: process.env.AXIOM_DATA_SET,
      token: process.env.AXIOM_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
    }),
    new WinstonTransports.Console({
      format: Winston.format.combine(Winston.format.colorize(), Winston.format.simple()),
    }),
  ],
}
