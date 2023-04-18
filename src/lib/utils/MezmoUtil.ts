import { IMezmoOptions } from '@interfaces/index.js'
import Mezmo from '@logdna/logger'
import { DEFAULT_MEZMO_OPTIONS, MEZMO_TOKEN_VARIABLES, NO_MEZMO_INGESTION_TOKEN } from '../index.js'

/**
 * This is a utility class for sending logs to [Mezmo/LogDNA][0]. All functions and info within this
 * class are _specifically_ related to the interactions with Mezmo.
 *
 * [0]: https://mezmo.com
 */
export class MezmoUtil {
  private logger: Mezmo.Logger

  private constructor(ingestionToken: string, opts?: IMezmoOptions) {
    // Instantiates the Logger class and combine the user provided options with the default options.
    this.logger = Mezmo.setupDefaultLogger(ingestionToken, {
      ...opts,
      ...DEFAULT_MEZMO_OPTIONS,
    })
  }

  /**
   * Attempts to find and return a [Mezmo](https://docs.logdna.com/docs/ingestion-key) ingestion
   * token to be used for sending log data to Mezmo. It does this by searching for an environment
   * variable with one of the following names (in order). If a value is found with one of the
   * variable names, it is returned. If no values are found, then `undefined` is returned.
   *
   * 1. MEZMO_TOKEN
   * 2. LOGDNA_TOKEN
   * 3. MEZMO_INGESTION_TOKEN
   * 4. LOGDNA_INGESTION_TOKEN
   * 5. INGESTION_TOKEN
   *
   * @returns Either the ingestion token or undefined.
   */
  public static getMezmoToken(): string | undefined {
    // Iterate through all available token variable names and see if a value is
    // present and return it if it is. I use an "indexed" for-loop because I
    // want to ensure the values are read in order.
    for (let x = 0; x < MEZMO_TOKEN_VARIABLES.length; x++) {
      const key = MEZMO_TOKEN_VARIABLES[x]

      if (process.env[key]) return process.env[key]
    }

    // If none of the variables had a value, return undefined.
    return undefined
  }

  /**
   * Initializes the LogDNA class. This method is required to be called before any other method in
   * the class.
   *
   * The optional `token` parameter is the ingestion token for the Mezmo/LogDNA tenant to which the
   * logs will be sent. If this parameter is not provided, the method will attempt to retrieve the
   * token from a number of environment variables (refer to the {@link MezmoUtil.getMezmoToken}
   * method for further details). If the token is not provided or found via either method, then an
   * error will be thrown.
   *
   * @param token The ingestion token to use when instantiating the Mezmo logger.
   *
   * @returns An instance of the {@link MezmoUtil} class.
   */
  public static init(
    token: string | undefined = this.getMezmoToken(),
    opts?: IMezmoOptions
  ): MezmoUtil {
    // Verify a token was provided or found.
    if (token) return new MezmoUtil(token, opts)
    // Throw an error if no token was found.
    else throw new Error(NO_MEZMO_INGESTION_TOKEN)
  }

  /**
   * This method adds a key-value to the global metadata, which is added to each log entry upon
   * calling `send()`. Although metadata can be set on instantiation, this method provides a way to
   * update it on-the-fly.
   *
   * @param key The key of the metadata to add.
   * @param value The value of the metadata to add.
   */
  public addMetaProperty(key: string, value: string): void {
    return this.logger.addMetaProperty(key, value)
  }

  /**
   * Sends the given message to Mezmo/LogDNA.
   *
   * @param msg The message to send to Mezmo/LogDNA.
   */
  public async send(msg: string, level: Mezmo.LogLevel = Mezmo.LogLevel.info): Promise<void> {
    return this.logger.log(msg, { level })
  }
}
