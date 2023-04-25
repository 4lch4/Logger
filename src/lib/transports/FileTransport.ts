import { BaseTransport } from '@bases/BaseTransport.js'
import { ITransportOptions } from '@interfaces/index.js'

export interface IFileTransportOptions extends ITransportOptions {
  /**
   * This string is the absolute path to a file that log data should be appended to.
   */
  path?: string
}

export class FileTransport extends BaseTransport {
  public constructor(protected override options: IFileTransportOptions) {
    super(options)
  }

  public override send(): void {
    throw new Error('Method not implemented.')
  }
}
