import Mezmo, { ConstructorOptions } from '@logdna/logger'
import { Defaults, ErrorMessages } from './index.js'

export interface ILogDNAOptions {
  app: string
}

/**
 * This class is a utility class for sending logs to my
 * [Mezmo/LogDNA](https://app.mezmo.com) tenant.
 */
export class LogDNA {
  private logger: Mezmo.Logger

  private constructor(apiKey: string, opts?: ConstructorOptions) {
    /**
     * Instantiate the Logger class and combine the user provided options with
     * the default options.
     */
    this.logger = Mezmo.setupDefaultLogger(apiKey, {
      ...opts,
      ...Defaults.LOGDNA_CONSTRUCTOR_OPTIONS
    })
  }

  /**
   * Initializes the LogDNA class. This method is required to be called before
   * any other method in the class.
   *
   * The optional `apiKey` parameter is the API key for the Mezmo/LogDNA tenant
   * to which the logs will be sent. If this parameter is not provided, the
   * method will attempt to retrieve the API key from the `MEZMO_API_KEY`
   * environment variable. If the API key is not provided via either method, an
   * error will be thrown.
   *
   * @param apiKey The API key to use when instantiating the LogDNA logger, can also be provided as an environment variable (`LOGDNA_API_KEY`).
   *
   * @returns An instance of the {@link LogDNA} class.
   */
  public static init(apiKey?: string): LogDNA {
    if (apiKey && apiKey.length > 0) {
      return new LogDNA(apiKey)
    } else if (process.env.LOGDNA_API_KEY && process.env.LOGDNA_API_KEY.length > 0) {
      return new LogDNA(process.env.LOGDNA_API_KEY)
    } else {
      throw new Error(ErrorMessages.MISSING_API_KEY)
    }
  }

  /**
   * This method adds a key-value to the global metadata, which is added to each
   * log entry upon calling `log()`. Although metadata can be set on
   * instantiation, this method provides a way to update it on-the-fly.
   *
   * @param key The key of the metadata to add.
   * @param value The value of the metadata to add.
   */
  public addMetaProperty(key: string, value: string): void {
    return this.logger.addMetaProperty(key, value)
  }

  /**
   * Sends the given message to my Mezmo/LogDNA tenant.
   *
   * @param msg The message to send to Mezmo/LogDNA.
   */
  public async send(msg: string, level: Mezmo.LogLevel = Mezmo.LogLevel.info): Promise<void> {
    return this.logger.log(msg, { level })
  }
}
