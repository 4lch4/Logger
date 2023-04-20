import { BaseTransport } from '@bases/index.js'
import { LogTransport } from '@interfaces/index.js'

/** An object containing the Transport related settings. */
export interface ITransportCollection {
  /**
   * An optional array containing the names of which built-in {@link LogTransport transport(s)}
   * which determine where log data is sent.
   *
   * Default: `console`
   */
  builtIn: LogTransport[]

  /** An optional array containing any and all custom Transport classes to use. */
  custom?: BaseTransport[]
}
