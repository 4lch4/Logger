import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { describe, mock, test } from 'node:test'
import { distUrl, waitFor } from './helpers.mjs'

const { SHUTDOWN_TIMEOUT_MS, buildLogger, createLogger, createStatusWriter, statusRecord } =
  await import(distUrl('logger.js'))

/** A configuration with every level on, for the tests that don't care about the filter. */
const CONFIG = { level: 'debug', format: 'json', resource: { 'service.name': 'test' } }

/**
 * Builds a configuration from the shared one.
 *
 * @param {Record<string, any>} [overrides] Values to change.
 * @returns {any} The configuration.
 */
function createConfig(overrides = {}) {
  return { ...CONFIG, ...overrides }
}

/**
 * Builds a fake exporter that records what it's given.
 *
 * @param {Record<string, any>} [overrides] Methods to replace.
 * @returns {any} The exporter.
 */
function fakeExporter(overrides = {}) {
  return {
    enqueue: mock.fn(),
    flush: mock.fn(() => Promise.resolve()),
    shutdown: mock.fn(() => Promise.resolve()),
    ...overrides,
  }
}

/**
 * Builds a fake reporter that records what it's given.
 *
 * @param {Record<string, any>} [overrides] Methods to replace.
 * @returns {any} The reporter.
 */
function fakeReporter(overrides = {}) {
  return {
    capture: mock.fn(),
    flush: mock.fn(() => Promise.resolve()),
    shutdown: mock.fn(() => Promise.resolve()),
    ...overrides,
  }
}

/**
 * Builds a `write` that keeps every chunk.
 *
 * @returns {any} The collector: `lines`, `text()` and `records()`.
 */
function createWrite() {
  const lines = []

  return {
    lines,
    write: text => lines.push(text),
    text() {
      return lines.join('')
    },
    records() {
      return lines
        .join('')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line))
    },
  }
}

/**
 * Builds a stand-in for `process`: an `EventEmitter` with an `exit` spy.
 *
 * @returns {any} A fake process.
 */
function fakeProcess() {
  const proc = new EventEmitter()

  proc.exit = mock.fn()

  return proc
}

describe('logging methods', () => {
  test('writes one JSON line per level with its level, message and the resource', () => {
    for (const level of ['error', 'warn', 'info', 'debug']) {
      const output = createWrite()
      const logger = buildLogger({ config: createConfig(), write: output.write })

      logger[level](`${level} message.`)

      assert.equal(output.lines.length, 1)

      const record = output.records()[0]

      assert.equal(record.level, level)
      assert.equal(record.message, `${level} message.`)
      assert.equal(record['service.name'], 'test')
      assert.match(record.time, /^\d{4}-\d{2}-\d{2}T/)
    }
  })

  test('drops every record below the configured level', () => {
    const levels = ['error', 'warn', 'info', 'debug']

    for (const configured of levels) {
      const output = createWrite()
      const exporter = fakeExporter()
      const reporter = fakeReporter()
      const logger = buildLogger({
        config: createConfig({ level: configured }),
        write: output.write,
        exporter,
        reporter,
      })

      for (const level of levels) {
        logger[level](`${level}.`, level === 'error' ? { error: new Error('Boom.') } : undefined)
      }

      const expected = levels.slice(0, levels.indexOf(configured) + 1)

      assert.deepEqual(
        output.records().map(record => record.level),
        expected,
        `stdout at ${configured}`
      )
      assert.equal(
        exporter.enqueue.mock.callCount(),
        expected.length,
        `the exporter at ${configured}`
      )
      assert.equal(
        reporter.capture.mock.callCount(),
        expected.includes('error') ? 1 : 0,
        `the reporter at ${configured}`
      )
    }
  })
})

describe('the record', () => {
  test('has the injected time, the level, the message and the merged attributes', () => {
    const time = new Date(1_767_225_600_123)
    const exporter = fakeExporter()
    const logger = buildLogger({
      config: createConfig(),
      write: createWrite().write,
      exporter,
      now: () => time,
    })

    logger.info('Shape.', { 'http.status': 500, ok: true })

    assert.equal(exporter.enqueue.mock.callCount(), 1)
    assert.deepEqual(exporter.enqueue.mock.calls[0].arguments[0], {
      time,
      level: 'info',
      message: 'Shape.',
      attributes: { 'http.status': 500, ok: true },
    })
  })
})

describe('child', () => {
  test('adds its attributes, stacks over two levels and lets the call win', () => {
    const exporter = fakeExporter()
    const logger = buildLogger({
      config: createConfig(),
      write: createWrite().write,
      exporter,
    })
    const child = logger.child({ subject: 'models', 'notification.source': 'ci' })
    const grandchild = child.child({ subject: 'overridden', extra: true })

    child.info('Child.', { subject: 'call' })
    grandchild.info('Grandchild.')
    logger.info('Parent.')

    const records = exporter.enqueue.mock.calls.map(call => call.arguments[0].attributes)

    assert.deepEqual(records[0], { subject: 'call', 'notification.source': 'ci' })
    assert.deepEqual(records[1], {
      subject: 'overridden',
      'notification.source': 'ci',
      extra: true,
    })
    assert.deepEqual(records[2], {})
  })

  test('ignores an error given to child', () => {
    const exporter = fakeExporter()
    const logger = buildLogger({
      config: createConfig(),
      write: createWrite().write,
      exporter,
    })

    logger.child({ error: new Error('Not this one.'), ok: true }).info('Quiet.')

    const attributes = exporter.enqueue.mock.calls[0].arguments[0].attributes

    assert.deepEqual(attributes, { ok: true })
    assert.equal('error' in attributes, false)
  })
})

describe('capturing exceptions', () => {
  test('an error with an error attribute captures it with only the other attributes', () => {
    const exporter = fakeExporter()
    const reporter = fakeReporter()
    const logger = buildLogger({
      config: createConfig(),
      write: createWrite().write,
      exporter,
      reporter,
    })
    const error = new Error('It broke.')

    logger.error('Delivery failed.', { error, 'delivery.channel': '#ci', 'http.status': 500 })

    assert.equal(reporter.capture.mock.callCount(), 1)

    const [givenError, attributes] = reporter.capture.mock.calls[0].arguments

    assert.equal(givenError, error)
    assert.deepEqual(attributes, { 'delivery.channel': '#ci', 'http.status': 500 })
    assert.equal(exporter.enqueue.mock.callCount(), 1)
    assert.equal(exporter.enqueue.mock.calls[0].arguments[0].attributes.error, error)
  })

  test('never captures without an error, or below the error level', () => {
    const reporter = fakeReporter()
    const exporter = fakeExporter()
    const logger = buildLogger({
      config: createConfig(),
      write: createWrite().write,
      exporter,
      reporter,
    })
    const error = new Error('Boom.')

    logger.error('No error.')
    logger.error('Undefined.', { error: undefined })
    logger.error('Null.', { error: null })
    logger.warn('Warn.', { error })
    logger.info('Info.', { error })
    logger.debug('Debug.', { error })

    assert.equal(reporter.capture.mock.callCount(), 0)
    assert.equal(exporter.enqueue.mock.callCount(), 6)
  })
})

describe('flush', () => {
  test('flushes both parts', async () => {
    const exporter = fakeExporter()
    const reporter = fakeReporter()
    const logger = buildLogger({
      config: createConfig(),
      write: createWrite().write,
      exporter,
      reporter,
    })

    await logger.flush()

    assert.equal(exporter.flush.mock.callCount(), 1)
    assert.equal(reporter.flush.mock.callCount(), 1)
  })

  test('resolves when a part rejects or throws', async () => {
    const cases = [
      fakeExporter({ flush: mock.fn(() => Promise.reject(new Error('No.'))) }),
      fakeExporter({
        flush: mock.fn(() => {
          throw new Error('Sync no.')
        }),
      }),
    ]

    for (const exporter of cases) {
      const reporter = fakeReporter({ flush: mock.fn(() => Promise.reject(new Error('No.'))) })
      const logger = buildLogger({
        config: createConfig(),
        write: createWrite().write,
        exporter,
        reporter,
      })

      await logger.flush()
    }
  })
})

describe('shutdown', () => {
  test('shuts both parts down once with the timeout, then only stdout is left', async () => {
    const output = createWrite()
    const exporter = fakeExporter()
    const reporter = fakeReporter()
    const logger = buildLogger({
      config: createConfig(),
      write: output.write,
      exporter,
      reporter,
      shutdownTimeoutMs: 250,
    })

    const first = logger.shutdown()
    const second = logger.shutdown()

    assert.equal(second, first)
    await first

    assert.equal(exporter.shutdown.mock.callCount(), 1)
    assert.equal(reporter.shutdown.mock.callCount(), 1)
    assert.deepEqual(exporter.shutdown.mock.calls[0].arguments, [250])
    assert.deepEqual(reporter.shutdown.mock.calls[0].arguments, [250])

    const written = output.lines.length

    logger.info('After.')
    logger.error('After error.', { error: new Error('Late.') })

    assert.equal(output.lines.length, written + 2)
    assert.equal(exporter.enqueue.mock.callCount(), 0)
    assert.equal(reporter.capture.mock.callCount(), 0)
  })

  test('defaults to SHUTDOWN_TIMEOUT_MS', async () => {
    const exporter = fakeExporter()
    const logger = buildLogger({ config: createConfig(), write: createWrite().write, exporter })

    assert.equal(SHUTDOWN_TIMEOUT_MS, 5_000)

    await logger.shutdown()

    assert.deepEqual(exporter.shutdown.mock.calls[0].arguments, [SHUTDOWN_TIMEOUT_MS])
  })

  test('resolves when a part rejects or throws', async () => {
    const cases = [
      fakeExporter({ shutdown: mock.fn(() => Promise.reject(new Error('No.'))) }),
      fakeExporter({
        shutdown: mock.fn(() => {
          throw new Error('Sync no.')
        }),
      }),
    ]

    for (const exporter of cases) {
      const reporter = fakeReporter({ shutdown: mock.fn(() => Promise.reject(new Error('No.'))) })
      const logger = buildLogger({
        config: createConfig(),
        write: createWrite().write,
        exporter,
        reporter,
      })

      await logger.shutdown()
    }
  })

  test('a child shuts the shared parts down, and the parent stops sending too', async () => {
    const output = createWrite()
    const exporter = fakeExporter()
    const reporter = fakeReporter()
    const logger = buildLogger({
      config: createConfig(),
      write: output.write,
      exporter,
      reporter,
    })
    const child = logger.child({ subject: 'models' })

    assert.equal(child.shutdown(), logger.shutdown())

    await child.shutdown()

    assert.equal(exporter.shutdown.mock.callCount(), 1)
    assert.equal(reporter.shutdown.mock.callCount(), 1)

    logger.info('Parent after.')
    child.info('Child after.')

    assert.equal(output.records().length, 2)
    assert.equal(exporter.enqueue.mock.callCount(), 0)
    assert.equal(reporter.capture.mock.callCount(), 0)
  })
})

describe('robustness', () => {
  test('nothing throws when write, enqueue or capture throws', () => {
    const logger = buildLogger({
      config: createConfig(),
      write: mock.fn(() => {
        throw new Error('stdout broke')
      }),
      exporter: fakeExporter({
        enqueue: mock.fn(() => {
          throw new Error('the exporter broke')
        }),
      }),
      reporter: fakeReporter({
        capture: mock.fn(() => {
          throw new Error('the reporter broke')
        }),
      }),
    })

    assert.doesNotThrow(() => logger.error('Boom.', { error: new Error('Boom.') }))
    assert.doesNotThrow(() => logger.info('Fine.'))
  })

  test('accepts a non-string message and attributes that are null', () => {
    const output = createWrite()
    const logger = buildLogger({ config: createConfig(), write: output.write })

    assert.doesNotThrow(() => logger.info(42))
    assert.doesNotThrow(() => logger.info('Null.', null))
    assert.doesNotThrow(() => logger.error('Null error.', null))
    assert.doesNotThrow(() =>
      logger.info({
        toString() {
          throw new Error('No text.')
        },
      })
    )

    const records = output.records()

    assert.equal(records[0].message, '42')
    assert.equal(records[1].message, 'Null.')
    assert.equal(records[2].message, 'Null error.')
  })
})

describe('statusRecord', () => {
  const now = () => new Date(1_767_225_600_000)

  test('turns a failing status into a warn record', () => {
    assert.deepEqual(statusRecord({ state: 'failing', reason: 'HTTP 503' }, now), {
      time: new Date(1_767_225_600_000),
      level: 'warn',
      message: 'Sending Logs to PostHog is failing.',
      attributes: { reason: 'HTTP 503' },
    })
  })

  test('turns a recovered status into an info record', () => {
    assert.deepEqual(statusRecord({ state: 'recovered', dropped: 12 }, now), {
      time: new Date(1_767_225_600_000),
      level: 'info',
      message: 'Sending Logs to PostHog recovered.',
      attributes: { 'records.dropped': 12 },
    })
  })
})

describe('createStatusWriter', () => {
  test('writes both statuses to stdout, obeying the level, and never enqueues them', () => {
    const output = createWrite()
    const exporter = fakeExporter()
    const config = createConfig()

    // The same shape createLogger wires into createOtlpExporter, with stdout collected here.
    const writeStatus = createStatusWriter(config, output.write)
    const logger = buildLogger({ config, write: output.write, exporter })

    writeStatus({ state: 'failing', reason: 'HTTP 503' })
    writeStatus({ state: 'recovered', dropped: 3 })
    logger.info('A normal record.')

    const records = output.records()

    assert.deepEqual(
      records.map(record => record.message),
      [
        'Sending Logs to PostHog is failing.',
        'Sending Logs to PostHog recovered.',
        'A normal record.',
      ]
    )
    assert.equal(records[0].level, 'warn')
    assert.equal(records[0].reason, 'HTTP 503')
    assert.equal(records[1].level, 'info')
    assert.equal(records[1]['records.dropped'], 3)
    assert.equal(exporter.enqueue.mock.callCount(), 1)
    assert.equal(
      exporter.enqueue.mock.calls[0].arguments[0].message,
      'A normal record.',
      'A status line reached the exporter.'
    )
  })

  test('writes nothing when the level filters the status out', () => {
    const output = createWrite()
    const writeStatus = createStatusWriter(createConfig({ level: 'error' }), output.write)

    writeStatus({ state: 'failing', reason: 'HTTP 503' })
    writeStatus({ state: 'recovered', dropped: 3 })

    assert.equal(output.lines.length, 0)
  })

  test('createLogger never throws whatever the environment holds', () => {
    assert.doesNotThrow(() => createLogger())
  })
})

describe('fatal errors', () => {
  for (const [kind, message] of [
    ['uncaughtException', 'Uncaught exception.'],
    ['unhandledRejection', 'Unhandled rejection.'],
  ]) {
    test(`${kind} is written, captured, flushed and then exits with 1`, async () => {
      const output = createWrite()
      const exporter = fakeExporter()
      const reporter = fakeReporter()
      const proc = fakeProcess()
      const error = new Error('Boom.')

      buildLogger({
        config: createConfig(),
        write: output.write,
        exporter,
        reporter,
        handleFatalErrors: true,
        process: proc,
        shutdownTimeoutMs: 100,
      })

      proc.emit(kind, error)

      await waitFor(() => proc.exit.mock.callCount() === 1)

      const records = output.records()

      assert.equal(records.length, 1)
      assert.equal(records[0].level, 'error')
      assert.equal(records[0].message, message)
      assert.equal(records[0]['exception.message'], 'Boom.')
      assert.equal(records[0]['exception.type'], 'Error')
      assert.equal(reporter.capture.mock.callCount(), 1)
      assert.equal(reporter.capture.mock.calls[0].arguments[0], error)
      assert.deepEqual(reporter.capture.mock.calls[0].arguments[1], {})
      assert.equal(exporter.flush.mock.callCount(), 1)
      assert.equal(reporter.flush.mock.callCount(), 1)
      assert.deepEqual(proc.exit.mock.calls[0].arguments, [1])
    })
  }

  test('shutdown removes the handlers', async () => {
    const proc = fakeProcess()
    const logger = buildLogger({
      config: createConfig(),
      write: createWrite().write,
      handleFatalErrors: true,
      process: proc,
      shutdownTimeoutMs: 100,
    })

    assert.equal(proc.listeners('uncaughtException').length, 1)
    assert.equal(proc.listeners('unhandledRejection').length, 1)

    await logger.shutdown()

    assert.deepEqual(proc.listeners('uncaughtException'), [])
    assert.deepEqual(proc.listeners('unhandledRejection'), [])
  })

  test('installs no handlers without handleFatalErrors', () => {
    const proc = fakeProcess()

    buildLogger({ config: createConfig(), write: createWrite().write, process: proc })

    assert.deepEqual(proc.listeners('uncaughtException'), [])
    assert.deepEqual(proc.listeners('unhandledRejection'), [])
  })
})
