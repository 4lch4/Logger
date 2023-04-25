import { BaseTransport } from '@bases/BaseTransport.js'
import { IConsoleTransportOptions, ILoggerInput } from '@interfaces/index.js'


export class ConsoleTransport extends BaseTransport {
  

  // private getMessage(data: string | ILoggerInput): string {
  //   let msg = []



  //   if (typeof data === 'string') {
  //     const msg = `[${this.dateUtil.getTimestamp()}]: ${data}`
  //     return `[${this.dateUtil.getTimestamp()}]: ${data}`
  //   }
  // }

  public override send(data: string | ILoggerInput): void {
    throw new Error('Method not implemented.')
  }
}


const tmpTransport = new ConsoleTransport({
  name: 'Console-Output',
  description: 'A standard transport for sending data to the console/stdout.',
  timestamp: true
}, {
  format: 'json'
})

