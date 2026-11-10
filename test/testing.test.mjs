import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { distUrl, runChild } from './helpers.mjs'

const { createTestLogger } = await import(distUrl('testing.js'))

describe('createTestLogger', () => {
  test('records every level, with no filter', () => {
    const logger = createTestLogger()
    const before = Date.now()

    logger.error('Error.')
    logger.warn('Warn.')
    logger.info('Info.')
    logger.debug('Debug.')

    assert.deepEqual(
      logger.records.map(record => record.level),
      ['error', 'warn', 'info', 'debug']
    )
    assert.deepEqual(
      logger.records.map(record => record.message),
      ['Error.', 'Warn.', 'Info.', 'Debug.']
    )

    for (const record of logger.records) {
      assert.ok(record.time instanceof Date)
      assert.ok(record.time.getTime() >= before && record.time.getTime() <= Date.now())
      assert.deepEqual(record.attributes, {})
    }
  })

  test('shares one records array with every child, oldest first', () => {
    const logger = createTestLogger()
    const child = logger.child({ subject: 'models' })
    const grandchild = child.child({ subject: 'other', extra: true })

    logger.info('First.')
    child.info('Second.')
    grandchild.info('Third.')

    assert.deepEqual(
      logger.records.map(record => record.message),
      ['First.', 'Second.', 'Third.']
    )
    assert.equal(child.records, undefined, 'the child exposed its own records array')
  })

  test('keeps attributes exactly as given, with error and without flattening', () => {
    const logger = createTestLogger()
    const error = new TypeError('It broke.')
    const nested = { a: 1 }

    logger.error('Failed.', { error, meta: nested, 'http.status': 500, missing: undefined })

    const attributes = logger.records[0].attributes

    assert.equal(attributes.error, error)
    assert.equal(attributes.meta, nested)
    assert.equal(attributes['http.status'], 500)
    assert.equal(Object.hasOwn(attributes, 'missing'), false)
    assert.equal('exception.type' in attributes, false)
  })

  test('child attributes stack, the call wins, and the parent is unchanged', () => {
    const logger = createTestLogger()
    const child = logger.child({ subject: 'models', 'notification.source': 'ci' })
    const grandchild = child.child({ subject: 'overridden', extra: true })

    child.info('Child.', { subject: 'call' })
    grandchild.info('Grandchild.')
    logger.info('Parent.')

    assert.deepEqual(logger.records[0].attributes, {
      subject: 'call',
      'notification.source': 'ci',
    })
    assert.deepEqual(logger.records[1].attributes, {
      subject: 'overridden',
      'notification.source': 'ci',
      extra: true,
    })
    assert.deepEqual(logger.records[2].attributes, {})
  })

  test('ignores an error given to child', () => {
    const logger = createTestLogger()

    logger.child({ error: new Error('Not this one.'), ok: true }).info('Quiet.')

    assert.deepEqual(logger.records[0].attributes, { ok: true })
  })

  test('flush and shutdown resolve, and recording continues after shutdown', async () => {
    const logger = createTestLogger()

    await logger.flush()
    await logger.shutdown()
    logger.info('After.')

    assert.equal(logger.records.length, 1)
    assert.equal(logger.records[0].message, 'After.')
  })

  test('reads no environment variables and writes nothing to stdout', async () => {
    const result = await runChild(
      `
const logger = lib.createTestLogger()
logger.error('Error.', { error: new Error('Boom.') })
logger.warn('Warn.')
logger.info('Info.')
logger.debug('Debug.')
logger.child({ subject: 'models' }).info('Child.')
await logger.flush()
await logger.shutdown()
logger.info('After.')
`,
      {
        env: {
          LOG_LEVEL: 'error',
          POSTHOG_API_KEY: 'phc_test',
          POSTHOG_HOST: 'http://127.0.0.1:1',
          OTEL_SERVICE_NAME: 'unused',
        },
      }
    )

    assert.equal(result.stdout, '')
    assert.equal(result.stderr, '')
    assert.equal(result.code, 0)
  })

  test('records every level in a child process whatever LOG_LEVEL says', async () => {
    const result = await runChild(
      `
const logger = lib.createTestLogger()
logger.debug('Still recorded.')
logger.warn('Warn.')
process.stdout.write(JSON.stringify(logger.records))
`,
      { env: { LOG_LEVEL: 'error' } }
    )

    assert.equal(result.code, 0)
    assert.deepEqual(
      JSON.parse(result.stdout).map(record => record.message),
      ['Still recorded.', 'Warn.']
    )
  })
})
