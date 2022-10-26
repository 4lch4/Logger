const logdna = require('@logdna/logger')

const options = {
  app: 'myAppName',
  level: 'debug' // set a default for when level is not provided in function calls
}

const logger = logdna.createLogger('<YOUR INGESTION KEY>', options)

logger.log('This is an INFO statement', 'info')

logger.log('This will be a DEBUG statement, based on the default')

logger.log('This is an INFO statement with an options object', {
  level: 'info',
  meta: {
    somekey: 'Arbitrary message',
    anotherkey: 'Another arbitrary message or data point'
  }
})

logger.info('This is an INFO statement using a convenience method')

// Objects can be logged, too, but they're just serialized
logger.info({
  message: 'Got some user data',
  userId: req.params.userId // This assumes `req.params` comes from some HTTP framework
})

// Just sets `level: 'error'` automatically
logger.error('An error was encountered while processing user data')
