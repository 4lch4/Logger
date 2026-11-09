import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { runChild, startCollector, waitFor } from './helpers.mjs'

/** The environment every end-to-end test uses unless it says otherwise. */
const BASE_ENV = {
  POSTHOG_API_KEY: 'phc_test',
  OTEL_SERVICE_NAME: 'itest',
  VCS_REVISION: 'abc123',
  OTEL_RESOURCE_ATTRIBUTES: 'deployment.environment.name=production',
}

/** Every resource attribute the tests expect on a record and an exception. */
const RESOURCE = {
  'service.name': 'itest',
  'vcs.revision': 'abc123',
  'deployment.environment.name': 'production',
}

/**
 * Reads one OTLP `AnyValue`.
 *
 * @param {any} value The encoded value.
 * @returns {any} The value as a primitive, an array or `undefined`.
 */
function readValue(value) {
  if (typeof value !== 'object' || value === null) return undefined
  if ('stringValue' in value) return value.stringValue
  if ('boolValue' in value) return value.boolValue
  if ('intValue' in value) return Number(value.intValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('arrayValue' in value) return value.arrayValue.values.map(readValue)

  return undefined
}

/**
 * Turns OTLP key/value pairs into an object.
 *
 * @param {any[]} [pairs] The pairs.
 * @returns {Record<string, any>} The attributes.
 */
function readAttributes(pairs = []) {
  return Object.fromEntries(pairs.map(({ key, value }) => [key, readValue(value)]))
}

/**
 * The requests the OTLP exporter sent.
 *
 * @param {any} collector The collector.
 * @returns {any[]} The log requests.
 */
function logRequests(collector) {
  return collector.requests.filter(request => request.url === '/i/v1/logs')
}

/**
 * Every log record in every OTLP request, in order.
 *
 * @param {any} collector The collector.
 * @returns {any[]} The records.
 */
function logRecords(collector) {
  return logRequests(collector).flatMap(
    request => request.json?.resourceLogs?.[0]?.scopeLogs?.[0]?.logRecords ?? []
  )
}

/**
 * Finds every `$exception` event in a parsed body.
 *
 * @param {any} value The parsed body.
 * @param {any[]} [found] The events found so far.
 * @returns {any[]} The events.
 */
function findExceptionEvents(value, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) findExceptionEvents(item, found)

    return found
  }

  if (typeof value !== 'object' || value === null) return found
  if (value.event === '$exception') {
    found.push(value)

    return found
  }

  for (const item of Object.values(value)) findExceptionEvents(item, found)

  return found
}

/**
 * Every `$exception` event the collector received.
 *
 * @param {any} collector The collector.
 * @returns {any[]} The events.
 */
function exceptionEvents(collector) {
  return collector.requests.flatMap(request => findExceptionEvents(request.json))
}

/**
 * Sets up a collector and closes it when the test is done, whatever happens.
 *
 * @param {(collector: any) => Promise<void>} run The test body.
 */
async function withCollector(run) {
  const collector = await startCollector()

  try {
    await run(collector)
  } finally {
    await collector.close()
  }
}

describe('without POSTHOG_API_KEY', () => {
  test('writes JSON lines to stdout, sends nothing and exits 0', async () => {
    await withCollector(async collector => {
      const result = await runChild(
        `
const logger = lib.createLogger()
logger.info('No key.', { 'notification.source': 'ci' })
logger.warn('Also no key.')
`,
        {
          env: {
            OTEL_SERVICE_NAME: 'itest',
            VCS_REVISION: 'abc123',
            OTEL_RESOURCE_ATTRIBUTES: 'deployment.environment.name=production',
          },
        }
      )

      assert.equal(result.code, 0, result.stderr)
      assert.equal(result.lines.length, 2)
      assert.equal(result.lines[0].level, 'info')
      assert.equal(result.lines[0].message, 'No key.')
      assert.equal(result.lines[0]['service.name'], 'itest')
      assert.equal(result.lines[0]['notification.source'], 'ci')
      assert.equal(result.lines[1].level, 'warn')
      assert.equal(collector.requests.length, 0)
    })
  })
})

describe('Logs', () => {
  test('sends the record over OTLP and writes the same record to stdout', async () => {
    await withCollector(async collector => {
      const result = await runChild(
        `
const logger = lib.createLogger({ version: '1.2.3' })
logger.info('Delivered.', { 'notification.source': 'ci' })
await logger.shutdown()
`,
        { env: { ...BASE_ENV, POSTHOG_HOST: collector.origin } }
      )

      assert.equal(result.code, 0, result.stderr)
      assert.equal(logRequests(collector).length, 1)

      const request = logRequests(collector)[0]

      assert.equal(request.method, 'POST')
      assert.equal(request.headers.authorization, 'Bearer phc_test')
      assert.equal(request.headers['content-type'], 'application/json')
      assert.deepEqual(readAttributes(request.json.resourceLogs[0].resource.attributes), {
        ...RESOURCE,
        'service.version': '1.2.3',
      })

      const [record] = logRecords(collector)

      assert.equal(record.severityNumber, 9)
      assert.equal(record.severityText, 'INFO')
      assert.equal(record.body.stringValue, 'Delivered.')
      assert.deepEqual(readAttributes(record.attributes), { 'notification.source': 'ci' })

      assert.equal(result.lines.length, 1)

      const [line] = result.lines

      assert.equal(line.level, 'info')
      assert.equal(line.message, 'Delivered.')
      assert.equal(line['service.name'], 'itest')
      assert.equal(line['service.version'], '1.2.3')
      assert.equal(line['vcs.revision'], 'abc123')
      assert.equal(line['deployment.environment.name'], 'production')
      assert.equal(line['notification.source'], 'ci')
    })
  })
})

describe('exceptions', () => {
  test('an error becomes one $exception event; a warn only carries exception attributes', async () => {
    await withCollector(async collector => {
      const result = await runChild(
        `
const logger = lib.createLogger()
logger.error('Delivery failed.', {
  error: new Error('It broke.'),
  'delivery.channel': '#ci',
})
logger.warn('Degraded.', { error: new Error('Soft.'), 'delivery.channel': '#ci' })
await logger.shutdown()
`,
        { env: { ...BASE_ENV, POSTHOG_HOST: collector.origin } }
      )

      assert.equal(result.code, 0, result.stderr)

      const records = logRecords(collector)

      assert.equal(records.length, 2)
      assert.equal(records[0].body.stringValue, 'Delivery failed.')

      const errorAttributes = readAttributes(records[0].attributes)

      assert.equal(errorAttributes['exception.type'], 'Error')
      assert.equal(errorAttributes['exception.message'], 'It broke.')
      assert.equal(errorAttributes['delivery.channel'], '#ci')
      assert.equal(typeof errorAttributes['exception.stacktrace'], 'string')

      const warnAttributes = readAttributes(records[1].attributes)

      assert.equal(records[1].body.stringValue, 'Degraded.')
      assert.equal(warnAttributes['exception.type'], 'Error')
      assert.equal(warnAttributes['exception.message'], 'Soft.')
      assert.equal(typeof warnAttributes['exception.stacktrace'], 'string')

      const events = exceptionEvents(collector)

      assert.equal(events.length, 1, 'a warn record created an exception')

      const [event] = events

      assert.equal(event.distinct_id, 'itest')
      assert.equal(event.properties['service.name'], 'itest')
      assert.equal(event.properties['vcs.revision'], 'abc123')
      assert.equal(event.properties['deployment.environment.name'], 'production')
      assert.equal(event.properties['delivery.channel'], '#ci')
      assert.equal(event.properties.$process_person_profile, false)
      assert.ok(Array.isArray(event.properties.$exception_list))
    })
  })
})

describe('the level', () => {
  test('LOG_LEVEL keeps an info record off stdout and out of every request', async () => {
    await withCollector(async collector => {
      const result = await runChild(
        `
const logger = lib.createLogger()
logger.info('Hidden.')
await logger.shutdown()
`,
        { env: { ...BASE_ENV, POSTHOG_HOST: collector.origin, LOG_LEVEL: 'warn' } }
      )

      assert.equal(result.code, 0, result.stderr)
      assert.deepEqual(result.lines, [])
      assert.equal(
        logRecords(collector).some(record => record.body.stringValue === 'Hidden.'),
        false
      )
    })
  })
})

describe('fatal errors', () => {
  for (const [kind, message, trigger] of [
    [
      'uncaught exception',
      'Uncaught exception.',
      "setTimeout(() => { throw new Error('kaboom') }, 10)",
    ],
    [
      'unhandled rejection',
      'Unhandled rejection.',
      "setTimeout(() => { Promise.reject(new Error('nobody catches me')) }, 10)",
    ],
  ]) {
    test(`records an ${kind}, sends it, and exits with 1`, async () => {
      await withCollector(async collector => {
        const result = await runChild(
          `
const logger = lib.createLogger()

// A real app has other work pending. Bun 1.4.4 ends a process whose only pending work is an
// unhandled rejection before the async flush runs, so this timer stands in for that work. The
// fatal handler still calls exit(1), so it never fires.
setTimeout(() => {}, 1000)
${trigger}
`,
          { env: { ...BASE_ENV, POSTHOG_HOST: collector.origin } }
        )

        assert.equal(result.code, 1, result.stderr)

        const line = result.lines.find(candidate => candidate.message === message)

        assert.ok(line, `No ${JSON.stringify(message)} line on stdout.`)
        assert.equal(line.level, 'error')
        assert.equal(typeof line['exception.stacktrace'], 'string')

        await waitFor(() =>
          logRecords(collector).some(record => record.body.stringValue === message)
        )
        await waitFor(() => exceptionEvents(collector).length === 1)
      })
    })
  }

  test('without POSTHOG_API_KEY the runtime crash is left alone', async () => {
    const result = await runChild(
      `
const logger = lib.createLogger()
setTimeout(() => { throw new Error('kaboom') }, 10)
`,
      { env: {} }
    )

    assert.notEqual(result.code, 0)
    assert.equal(result.stdout.includes('Uncaught exception.'), false)
  })
})

describe('without shutdown', () => {
  test('a process that only logs exits by itself', async () => {
    await withCollector(async collector => {
      const started = Date.now()
      const result = await runChild(
        `
const logger = lib.createLogger()
logger.info('Nobody flushes me.')
`,
        { env: { ...BASE_ENV, POSTHOG_HOST: collector.origin } }
      )

      assert.equal(result.code, 0, result.stderr)
      assert.equal(result.signal, null)
      assert.ok(Date.now() - started < 5_000, `The child took ${Date.now() - started} ms.`)
    })
  })
})

describe('when PostHog is down', () => {
  test('stdout gets every record and one warning, and the warning is never sent', async () => {
    await withCollector(async collector => {
      collector.respondWith(503)

      const result = await runChild(
        `
const logger = lib.createLogger()
for (let index = 0; index < 5; index++) logger.info('First ' + index + '.')
await logger.flush()
for (let index = 0; index < 5; index++) logger.info('Second ' + index + '.')
await logger.flush()
await logger.shutdown()
`,
        { env: { ...BASE_ENV, POSTHOG_HOST: collector.origin } }
      )

      assert.equal(result.code, 0, result.stderr)

      const written = result.lines.filter(line => line.level === 'info')

      assert.deepEqual(
        written.map(line => line.message),
        [
          'First 0.',
          'First 1.',
          'First 2.',
          'First 3.',
          'First 4.',
          'Second 0.',
          'Second 1.',
          'Second 2.',
          'Second 3.',
          'Second 4.',
        ]
      )

      const warnings = result.lines.filter(
        line => line.message === 'Sending Logs to PostHog is failing.'
      )

      assert.equal(warnings.length, 1)
      assert.equal(warnings[0].level, 'warn')
      assert.equal(warnings[0].reason, 'HTTP 503')
      assert.ok(collector.requests.length > 0, 'the exporter never tried to send')
      assert.equal(
        logRecords(collector).some(
          record => record.body.stringValue === 'Sending Logs to PostHog is failing.'
        ),
        false,
        'the warning was sent to PostHog'
      )
    })
  })
})

describe('the default logger', () => {
  test('a test logger writes nothing and sends nothing', async () => {
    await withCollector(async collector => {
      const result = await runChild(
        `
lib.createTestLogger().info('x')
`,
        { env: { ...BASE_ENV, POSTHOG_HOST: collector.origin } }
      )

      assert.equal(result.code, 0, result.stderr)
      assert.equal(result.stdout, '')
      assert.equal(collector.requests.length, 0)
    })
  })

  test('logger.info creates it on first use and logger.shutdown sends the record', async () => {
    await withCollector(async collector => {
      const result = await runChild(
        `
lib.logger.info('x')
await lib.logger.shutdown()
`,
        { env: { ...BASE_ENV, POSTHOG_HOST: collector.origin } }
      )

      assert.equal(result.code, 0, result.stderr)

      await waitFor(() => logRecords(collector).some(record => record.body.stringValue === 'x'))
      assert.equal(
        logRecords(collector).filter(record => record.body.stringValue === 'x').length,
        1
      )
    })
  })
})

describe('without a service name', () => {
  test('warns once on stdout and uses the unknown service for exceptions', async () => {
    await withCollector(async collector => {
      const result = await runChild(
        `
const logger = lib.createLogger()
logger.info('One.')
logger.info('Two.')
logger.error('Failed.', { error: new Error('It broke.') })
await logger.shutdown()
`,
        {
          env: {
            POSTHOG_API_KEY: 'phc_test',
            POSTHOG_HOST: collector.origin,
            VCS_REVISION: 'abc123',
          },
        }
      )

      assert.equal(result.code, 0, result.stderr)

      const warnings = result.lines.filter(line => line.message === 'No service name is set.')

      assert.equal(warnings.length, 1)
      assert.equal(warnings[0].level, 'warn')
      assert.equal(warnings[0].hint, 'Set OTEL_SERVICE_NAME or pass service to createLogger.')

      const [event] = exceptionEvents(collector)

      assert.ok(event, 'No $exception event.')
      assert.equal(event.distinct_id, 'unknown_service')
    })
  })

  test('does not warn without POSTHOG_API_KEY', async () => {
    const result = await runChild(
      `
const logger = lib.createLogger()
logger.info('One.')
logger.info('Two.')
`,
      { env: {} }
    )

    assert.equal(result.code, 0, result.stderr)
    assert.equal(
      result.lines.some(line => line.message === 'No service name is set.'),
      false
    )
  })
})

describe('public exports', () => {
  test('exports exactly the four runtime values', async () => {
    const result = await runChild(`process.stdout.write(JSON.stringify(Object.keys(lib).sort()))`)

    assert.equal(result.code, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), [
      'LEVELS',
      'createLogger',
      'createTestLogger',
      'logger',
    ])
  })
})
