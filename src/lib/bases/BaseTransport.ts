import { ILoggerInput, IOutputOptions, ITransportOptions } from '@interfaces/index.js'
import { DateUtil } from '@utils/index.js'

/**
 * This class is to be extended by any and all Transport classes, as it provides a uniform base
 * structure to all of them.
 */
export abstract class BaseTransport {
  protected dateUtil: DateUtil = new DateUtil()

  public constructor(
    protected transportOptions: ITransportOptions,
    protected outputOptions: IOutputOptions
  ) {}

  public abstract send(data: string | ILoggerInput): void
}
