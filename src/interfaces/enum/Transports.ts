/**
 * This enum represents the different transports that can be used for where logs
 * should be sent.
 */
export enum Transports {
  /** Logs are sent to a file in local storage. */
  File = 'file',

  /** Logs are sent to `STDOUT` and `STDERR` in the console. */
  Console = 'console',

  /** Logs are sent to my instance of `Graylog`. */
  Graylog = 'graylog'
}
