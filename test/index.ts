import { logger } from '../src/index.js'

async function main() {
  try {
    logger.info('[logger]: Testing basic logger export...')
    logger.info('[logger]: logger.info...')
    logger.clear()
    logger.count()
    logger.countReset()
    logger.debug('')
    logger.dir('')
    logger.divider(8)
    logger.error('')
    logger.group('')
    logger.groupEnd()
    logger.log('', '', '')
    logger.success('')
    logger.table([''], [''])
    logger.time('')
    logger.timeEnd('')
    logger.timeLog('')
    logger.trace('')
    logger.warn('')
  } catch (error) {
    throw error
  }
}

main()
  .then(res => {
    console.log('[test/index.ts]: Execution completed successfully!')
    console.log(
      '[test/index.ts]: The following line is whatever was returned from the main method:'
    )
    console.log(res)

    // Since the tests were successful, ensure exit code is set to `0`.
    process.exitCode = 0
  })
  .catch(err => {
    console.error('[test/index.ts]: Execution failed with an error:')
    console.error(err)

    // Since the tests errored _somewhere_, ensure exit code is set to `1.`
    process.exitCode = 1
  })
