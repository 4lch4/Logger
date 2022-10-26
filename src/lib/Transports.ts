import { format, transports } from 'winston'
import DailyRotate from 'winston-daily-rotate-file'

export const Transports = [
  new DailyRotate({
    auditFile: 'logger-audit.json',
    utc: true,
    extension: 'log'
  }),
  new transports.Console({
    eol: '\n',
    format: format.combine(
      format((info, opts) => {
        console.log(opts)

        return info
      })
    )
  })
]
