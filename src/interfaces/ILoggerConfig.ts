import Winston from 'winston'

export interface ILoggerConfig {
  /** The format of the messages that are logged. */
  defaultFormat?: Winston.Logform.Format

  /** The default meta data that is logged. */
  defaultMeta?: { [key: string]: any }

  /** The default level that is logged. */
  defaultLevel?: string

  /** The default transports that are used. */
  defaultTransports?: Winston.transport[]
}
