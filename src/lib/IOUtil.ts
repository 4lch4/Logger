import dayjs from 'dayjs'
import { appendFileSync, ensureDirSync, ensureFileSync } from 'fs-extra'
import { join } from 'path'
import { ILogFilePaths, Level, LogFormat } from '../interfaces'

export class IOUtil {
  /**
   * A collection with each LogLevel and a path to the file where messages at
   * this level should be stored.
   */
  private logFilePaths: ILogFilePaths

  /** The date in YYYY.MM.DD format to be used for log file names. */
  private logDay: string

  /** The directory where we'll store our log files. */
  private logDir: string

  constructor(baseDir?: string, _format?: LogFormat) {
    if (baseDir) {
      if (baseDir.endsWith('logs')) this.logDir = baseDir
      else this.logDir = join(baseDir, 'logs')
    } else this.logDir = join(__dirname, 'logs')

    this.logDay = dayjs().format('YYYY.MM.DD')

    this.logFilePaths = {
      debug: join(this.logDir, this.getFilename(Level.debug)),
      error: join(this.logDir, this.getFilename(Level.error)),
      info: join(this.logDir, this.getFilename(Level.info)),
      success: join(this.logDir, this.getFilename(Level.success)),
      warn: join(this.logDir, this.getFilename(Level.warn))
    }
  }

  private getFilename(level: Level) {
    return `${this.logDay}-${level}.log`
  }

  private getLogFile(level: Level) {
    try {
      ensureDirSync(this.logDir)
      ensureFileSync(this.logFilePaths[level])

      return this.logFilePaths[level]
    } catch (err) {
      return err
    }
  }

  private writeToFile(path: string, content: string | Object) {
    const filePrefix = dayjs().format('YYYY.MM.DD-HH.mm.ss')

    return appendFileSync(path, `[${filePrefix}] - ${content}\n`, {
      encoding: 'utf8'
    })
  }

  writeToLog(msg: string | Object, level: Level) {
    const filePath = this.getLogFile(level)
    return this.writeToFile(filePath, msg)
  }
}
