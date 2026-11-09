import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { after, before, describe, mock, test } from 'node:test'
import { distUrl, runChild, startCollector, waitFor } from './helpers.mjs'

const { createExceptionReporter, installProcessHandlers, UNKNOWN_SERVICE } = await import(
  distUrl('exceptions.js')
)

/** The resource attributes the reporter tests use. */
const RESOURCE = { 'service.name': 'checkout', 'vcs.revision': 'abc123' }

/**
 * Builds a stand-in for the `posthog-node` client that records what it's given.
 *
 * @param {Record<string, any>} [overrides] Methods to replace.
 * @returns {any} A fake client.
 */
function fakeClient(overrides = {}) {
  return {
    captureException: mock.fn(),
    flush: mock.fn(() => Promise.resolve()),
    shutdown: mock.fn(() => Promise.resolve()),
    ...overrides,
  }
}

/**
 * Creates a reporter with a fake client and a fake host.
 *
 * @param {any} client The client to use.
 * @param {Record<string, any>} [resource] The resource attributes.
 * @returns {any} The reporter.
 */
function createReporter(client, resource = RESOURCE) {
  return createExceptionReporter({
    apiKey: 'phc_test',
    host: 'http://127.0.0.1:1',
    resource,
    client,
  })
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

/**
 * Waits a short while, so a handler that finishes in microtasks can clear its state.
 *
 * @param {number} [ms] How long to wait.
 * @returns {Promise<void>} Resolves after the wait.
 */
function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Finds the `$exception` event in a request body, wherever the client put it.
 *
 * @param {any} value The parsed request body.
 * @returns {any} The event, or `undefined`.
 */
function findExceptionEvent(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findExceptionEvent(item)

      if (found) return found
    }

    return undefined
  }

  if (typeof value !== 'object' || value === null) return undefined
  if (value.event === '$exception') return value

  for (const item of Object.values(value)) {
    const found = findExceptionEvent(item)

    if (found) return found
  }

  return undefined
}

describe('createExceptionReporter', () => {
  test('sends the error, the service as the distinct id and the flat properties', () => {
    const client = fakeClient()
    const reporter = createReporter(client)
    const error = new Error('Failed.')

    reporter.capture(error, { 'notification.source': 'ci', 'http.status': 500 })

    assert.equal(client.captureException.mock.callCount(), 1)

    const [givenError, distinctId, properties] = client.captureException.mock.calls[0].arguments

    assert.equal(givenError, error)
    assert.equal(distinctId, 'checkout')
    assert.deepEqual(properties, {
      'service.name': 'checkout',
      'vcs.revision': 'abc123',
      'notification.source': 'ci',
      'http.status': 500,
      $process_person_profile: false,
    })
  })

  test('uses the unknown service when the resource has no service name', () => {
    assert.equal(UNKNOWN_SERVICE, 'unknown_service')

    const client = fakeClient()
    const reporter = createReporter(client, { 'vcs.revision': 'abc123' })

    reporter.capture(new Error('Failed.'), {})

    assert.equal(client.captureException.mock.calls[0].arguments[1], 'unknown_service')
  })

  test('uses the unknown service when the service name is empty', () => {
    const client = fakeClient()
    const reporter = createReporter(client, { 'service.name': '' })

    reporter.capture(new Error('Failed.'), {})

    assert.equal(client.captureException.mock.calls[0].arguments[1], 'unknown_service')
  })

  test('uses the unknown service when the service name is not a string', () => {
    const client = fakeClient()
    const reporter = createReporter(client, { 'service.name': 42 })

    reporter.capture(new Error('Failed.'), {})

    assert.equal(client.captureException.mock.calls[0].arguments[1], 'unknown_service')
  })

  test('an attribute cannot override $process_person_profile', () => {
    const client = fakeClient()
    const reporter = createReporter(client)

    reporter.capture(new Error('Failed.'), { $process_person_profile: true })

    assert.equal(client.captureException.mock.calls[0].arguments[2].$process_person_profile, false)
  })

  test('capture never throws when the client throws or rejects', async () => {
    const throwing = fakeClient({
      captureException: mock.fn(() => {
        throw new Error('The client broke.')
      }),
    })
    const rejecting = fakeClient({
      captureException: mock.fn(() => Promise.reject(new Error('The client broke.'))),
    })
    const unhandled = []
    const onUnhandled = reason => unhandled.push(reason)

    process.on('unhandledRejection', onUnhandled)

    try {
      assert.doesNotThrow(() => createReporter(throwing).capture(new Error('Failed.'), {}))
      assert.doesNotThrow(() => createReporter(rejecting).capture(new Error('Failed.'), {}))

      await tick(50)
      assert.deepEqual(unhandled, [])
    } finally {
      process.removeListener('unhandledRejection', onUnhandled)
    }
  })

  test('flush resolves when the client throws or rejects', async () => {
    const throwing = fakeClient({
      flush: mock.fn(() => {
        throw new Error('The client broke.')
      }),
    })
    const rejecting = fakeClient({ flush: mock.fn(() => Promise.reject(new Error('No.'))) })

    await createReporter(throwing).flush()
    await createReporter(rejecting).flush()
  })

  test('flush asks the client to flush', async () => {
    const client = fakeClient()
    const reporter = createReporter(client)

    await reporter.flush()

    assert.equal(client.flush.mock.callCount(), 1)
  })

  test('shutdown resolves within the time limit when the client hangs', async () => {
    const client = fakeClient({ shutdown: mock.fn(() => new Promise(() => {})) })
    const reporter = createReporter(client)
    const started = Date.now()

    await reporter.shutdown(50)

    assert.ok(Date.now() - started < 2000, 'shutdown took too long')
  })

  test('shutdown resolves when the client throws or rejects', async () => {
    const throwing = fakeClient({
      shutdown: mock.fn(() => {
        throw new Error('The client broke.')
      }),
    })
    const rejecting = fakeClient({ shutdown: mock.fn(() => Promise.reject(new Error('No.'))) })

    await createReporter(throwing).shutdown(100)
    await createReporter(rejecting).shutdown(100)
  })

  test('shutdown calls the client once and capture does nothing after it', async () => {
    const client = fakeClient({
      shutdown: mock.fn(() => new Promise(resolve => setTimeout(resolve, 10))),
    })
    const reporter = createReporter(client)

    const first = reporter.shutdown(1000)
    const second = reporter.shutdown(1000)

    assert.equal(second, first)

    await first

    assert.equal(client.shutdown.mock.callCount(), 1)

    reporter.capture(new Error('Too late.'), {})

    assert.equal(client.captureException.mock.callCount(), 0)
  })
})

describe('with the real posthog-node client', () => {
  /** @type {Awaited<ReturnType<typeof startCollector>>} */
  let collector

  before(async () => {
    collector = await startCollector()
  })

  after(async () => {
    await collector.close()
  })

  test('sends an $exception event with the resource and the record attributes', async () => {
    const reporter = createExceptionReporter({
      apiKey: 'phc_test',
      host: collector.origin,
      resource: { 'service.name': 'real-client', 'vcs.revision': 'abc123' },
    })

    try {
      reporter.capture(new Error('It broke.'), {
        'notification.source': 'ci',
        'http.status': 500,
      })

      await reporter.flush()

      const request = await waitFor(() =>
        collector.requests.find(candidate => findExceptionEvent(candidate.json))
      )
      const event = findExceptionEvent(request.json)

      assert.ok(event, 'No $exception event in the request body.')
      assert.equal(event.event, '$exception')
      assert.equal(event.distinct_id, 'real-client')
      assert.equal(event.properties['service.name'], 'real-client')
      assert.equal(event.properties['vcs.revision'], 'abc123')
      assert.equal(event.properties['notification.source'], 'ci')
      assert.equal(event.properties['http.status'], 500)
      assert.equal(event.properties.$process_person_profile, false)
      assert.ok(Array.isArray(event.properties.$exception_list))
    } finally {
      await reporter.shutdown(1000)
    }
  })

  test('a process that captures without flushing exits by itself', async () => {
    const ownCollector = await startCollector()

    try {
      const result = await runChild(
        `
const { createExceptionReporter } = await import(${JSON.stringify(distUrl('exceptions.js'))})
const reporter = createExceptionReporter({
  apiKey: 'phc_test',
  host: ${JSON.stringify(ownCollector.origin)},
  resource: { 'service.name': 'exits-by-itself' },
})
reporter.capture(new Error('Nobody flushes me.'))
`,
        { timeoutMs: 4000 }
      )

      assert.equal(result.signal, null, 'the process had to be killed')
      assert.equal(result.code, 0)
    } finally {
      await ownCollector.close()
    }
  })
})

describe('installProcessHandlers', () => {
  test('an uncaught exception is recorded, then exits with 1 when the app has no listener', async () => {
    const proc = fakeProcess()
    const onFatal = mock.fn(async () => {})
    const error = new Error('Boom.')

    installProcessHandlers({ onFatal, process: proc })
    proc.emit('uncaughtException', error)

    await waitFor(() => proc.exit.mock.callCount() === 1)

    assert.deepEqual(onFatal.mock.calls[0].arguments, [error, 'uncaughtException'])
    assert.deepEqual(proc.exit.mock.calls[0].arguments, [1])
  })

  test('an uncaught exception does not exit when the app has its own listener', async () => {
    const proc = fakeProcess()
    const own = mock.fn()
    const onFatal = mock.fn(async () => {})
    const first = new Error('First.')
    const second = new Error('Second.')

    proc.on('uncaughtException', own)
    installProcessHandlers({ onFatal, process: proc })

    proc.emit('uncaughtException', first)

    await waitFor(() => onFatal.mock.callCount() === 1)
    await tick()

    assert.equal(proc.exit.mock.callCount(), 0)
    assert.deepEqual(own.mock.calls[0].arguments, [first])

    // The mark is cleared, so a later error is handled too.
    proc.emit('uncaughtException', second)

    await waitFor(() => onFatal.mock.callCount() === 2)
    await tick()

    assert.equal(proc.exit.mock.callCount(), 0)
    assert.deepEqual(onFatal.mock.calls[1].arguments, [second, 'uncaughtException'])
  })

  test('an unhandled rejection is recorded, then exits with 1 when the app has no listener', async () => {
    const proc = fakeProcess()
    const onFatal = mock.fn()
    const reason = new Error('Rejected.')

    installProcessHandlers({ onFatal, process: proc })
    proc.emit('unhandledRejection', reason)

    await waitFor(() => proc.exit.mock.callCount() === 1)

    assert.deepEqual(onFatal.mock.calls[0].arguments, [reason, 'unhandledRejection'])
    assert.deepEqual(proc.exit.mock.calls[0].arguments, [1])
  })

  test('an unhandled rejection does not exit when the app has its own rejection listener', async () => {
    const proc = fakeProcess()
    const own = mock.fn()
    const onFatal = mock.fn()
    const first = new Error('First.')
    const second = new Error('Second.')

    proc.on('unhandledRejection', own)
    installProcessHandlers({ onFatal, process: proc })

    proc.emit('unhandledRejection', first)

    await waitFor(() => onFatal.mock.callCount() === 1)
    await tick()

    assert.equal(proc.exit.mock.callCount(), 0)
    assert.deepEqual(own.mock.calls[0].arguments, [first])

    proc.emit('unhandledRejection', second)

    await waitFor(() => onFatal.mock.callCount() === 2)
    await tick()

    assert.equal(proc.exit.mock.callCount(), 0)
  })

  test('an unhandled rejection is handed to the app own uncaught exception listeners', async () => {
    const proc = fakeProcess()
    const first = mock.fn()
    const second = mock.fn(() => {
      throw new Error('The listener broke.')
    })
    const onFatal = mock.fn()
    const reason = new Error('Rejected.')

    proc.on('uncaughtException', second)
    proc.on('uncaughtException', first)
    installProcessHandlers({ onFatal, process: proc })

    proc.emit('unhandledRejection', reason)

    await waitFor(() => first.mock.callCount() === 1)
    await tick()

    assert.equal(proc.exit.mock.callCount(), 0)
    assert.deepEqual(first.mock.calls[0].arguments, [reason, 'unhandledRejection'])
    assert.deepEqual(second.mock.calls[0].arguments, [reason, 'unhandledRejection'])
  })

  test('a hanging onFatal is given up at the time limit and the process still exits', async () => {
    const proc = fakeProcess()
    const onFatal = mock.fn(() => new Promise(() => {}))
    const started = Date.now()

    installProcessHandlers({ onFatal, process: proc, timeoutMs: 50 })
    proc.emit('uncaughtException', new Error('Slow.'))

    await waitFor(() => proc.exit.mock.callCount() === 1)

    assert.ok(Date.now() - started < 2000, 'the handler took too long')
    assert.deepEqual(proc.exit.mock.calls[0].arguments, [1])
  })

  test('an onFatal that throws does not keep the process alive', async () => {
    const proc = fakeProcess()
    const onFatal = mock.fn(() => {
      throw new Error('The handler broke.')
    })

    installProcessHandlers({ onFatal, process: proc })
    proc.emit('uncaughtException', new Error('Boom.'))

    await waitFor(() => proc.exit.mock.callCount() === 1)

    assert.deepEqual(proc.exit.mock.calls[0].arguments, [1])
  })

  test('a second fatal error is ignored while the first is being handled', async () => {
    const proc = fakeProcess()
    const own = mock.fn()
    let release = () => {}
    const onFatal = mock.fn(
      () =>
        new Promise(resolve => {
          release = resolve
        })
    )

    proc.on('uncaughtException', own)
    installProcessHandlers({ onFatal, process: proc })

    proc.emit('uncaughtException', new Error('First.'))
    proc.emit('uncaughtException', new Error('Second.'))

    await tick()

    assert.equal(onFatal.mock.callCount(), 1)

    release()
    await tick()

    proc.emit('uncaughtException', new Error('Third.'))

    await waitFor(() => onFatal.mock.callCount() === 2)
  })

  test('installing twice reuses the first handlers and the first remove function', async () => {
    const proc = fakeProcess()
    const first = mock.fn()
    const second = mock.fn()

    const removeFirst = installProcessHandlers({ onFatal: first, process: proc })
    const removeSecond = installProcessHandlers({ onFatal: second, process: proc })

    assert.equal(removeSecond, removeFirst)
    assert.equal(proc.listeners('uncaughtException').length, 1)
    assert.equal(proc.listeners('unhandledRejection').length, 1)

    proc.emit('uncaughtException', new Error('Boom.'))

    await waitFor(() => proc.exit.mock.callCount() === 1)

    assert.equal(first.mock.callCount(), 1)
    assert.equal(second.mock.callCount(), 0)
  })

  test('keeps the state of each process object apart', async () => {
    const first = fakeProcess()
    const second = fakeProcess()
    const firstFatal = mock.fn()
    const secondFatal = mock.fn()

    installProcessHandlers({ onFatal: firstFatal, process: first })
    installProcessHandlers({ onFatal: secondFatal, process: second })

    first.emit('uncaughtException', new Error('Only the first one.'))

    await waitFor(() => first.exit.mock.callCount() === 1)

    assert.equal(firstFatal.mock.callCount(), 1)
    assert.equal(secondFatal.mock.callCount(), 0)
    assert.equal(second.exit.mock.callCount(), 0)
    assert.equal(second.listeners('uncaughtException').length, 1)
  })

  test('remove removes both handlers, is harmless twice, and allows a fresh install', async () => {
    const proc = fakeProcess()
    const first = mock.fn()
    const removeFirst = installProcessHandlers({ onFatal: first, process: proc })

    removeFirst()

    assert.deepEqual(proc.listeners('uncaughtException'), [])
    assert.deepEqual(proc.listeners('unhandledRejection'), [])

    proc.emit('uncaughtException', new Error('No one listens.'))

    await tick()

    assert.equal(first.mock.callCount(), 0)
    assert.equal(proc.exit.mock.callCount(), 0)

    const next = mock.fn()
    const removeNext = installProcessHandlers({ onFatal: next, process: proc })

    // Calling the old remove function again must not remove the new handlers.
    removeFirst()

    assert.equal(proc.listeners('uncaughtException').length, 1)
    assert.equal(proc.listeners('unhandledRejection').length, 1)

    proc.emit('unhandledRejection', new Error('Rejected.'))

    await waitFor(() => proc.exit.mock.callCount() === 1)

    assert.equal(next.mock.callCount(), 1)

    removeNext()
    removeNext()

    assert.deepEqual(proc.listeners('uncaughtException'), [])
    assert.deepEqual(proc.listeners('unhandledRejection'), [])
  })
})

describe('installProcessHandlers in a real process', () => {
  test('records an uncaught exception, then exits with 1', async () => {
    const result = await runChild(
      `
const { installProcessHandlers } = await import(${JSON.stringify(distUrl('exceptions.js'))})
installProcessHandlers({
  onFatal(error, kind) {
    console.log('FATAL ' + kind + ' ' + error.message)
  },
})
setTimeout(() => {
  throw new Error('kaboom')
}, 10)
`,
      { timeoutMs: 4000 }
    )

    assert.match(result.stdout, /FATAL uncaughtException kaboom/)
    assert.equal(result.code, 1)
  })

  test('records an unhandled rejection, then exits with 1', async () => {
    const result = await runChild(
      `
const { installProcessHandlers } = await import(${JSON.stringify(distUrl('exceptions.js'))})
installProcessHandlers({
  onFatal(error, kind) {
    console.log('FATAL ' + kind + ' ' + error.message)
  },
})
setTimeout(() => {
  Promise.reject(new Error('nobody catches me'))
}, 10)
`,
      { timeoutMs: 4000 }
    )

    assert.match(result.stdout, /FATAL unhandledRejection nobody catches me/)
    assert.equal(result.code, 1)
  })

  for (const [kind, trigger] of [
    ['uncaughtException', "setTimeout(() => { throw new Error('late') }, 10)"],
    ['unhandledRejection', "Promise.reject(new Error('late'))"],
  ]) {
    test(`waits for an onFatal that has nothing else keeping the process alive (${kind})`, async () => {
      const result = await runChild(
        `
const { installProcessHandlers } = await import(${JSON.stringify(distUrl('exceptions.js'))})
installProcessHandlers({
  async onFatal(error, kind) {
    // Stands in for a flush whose only timer doesn't keep the process alive.
    await new Promise(resolve => setTimeout(resolve, 150).unref())
    console.log('FLUSHED ' + kind + ' ' + error.message)
  },
})
${trigger}
`,
        { timeoutMs: 4000 }
      )

      assert.match(result.stdout, new RegExp('FLUSHED ' + kind + ' late'))
      assert.equal(result.code, 1)
    })
  }

  test('leaves the process running when the app has its own uncaught exception listener', async () => {
    const result = await runChild(
      `
const { installProcessHandlers } = await import(${JSON.stringify(distUrl('exceptions.js'))})
process.on('uncaughtException', () => {})
installProcessHandlers({
  onFatal(error, kind) {
    console.log('FATAL ' + kind + ' ' + error.message)
  },
})
setTimeout(() => {
  throw new Error('handled by the app')
}, 10)
setTimeout(() => {
  process.exit(0)
}, 200)
`,
      { timeoutMs: 4000 }
    )

    assert.match(result.stdout, /FATAL uncaughtException handled by the app/)
    assert.equal(result.code, 0)
  })

  test('writes nothing itself', async () => {
    const result = await runChild(
      `
const { installProcessHandlers } = await import(${JSON.stringify(distUrl('exceptions.js'))})
installProcessHandlers({ onFatal() {} })
setTimeout(() => {
  throw new Error('silent')
}, 10)
`,
      { timeoutMs: 4000 }
    )

    assert.equal(result.stdout, '')
    assert.equal(result.stderr, '')
    assert.equal(result.code, 1)
  })
})
