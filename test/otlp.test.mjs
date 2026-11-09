import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { distUrl, runChild, startCollector, waitFor } from './helpers.mjs'

const { buildPayload, createOtlpExporter, toOtlpValue } = await import(distUrl('otlp.js'))

/** A record at a fixed time, for the tests that don't care when it was written. */
function record(message, overrides = {}) {
  return {
    time: new Date(1_767_225_600_000),
    level: 'info',
    message,
    attributes: {},
    ...overrides,
  }
}

/** Every record body in a request, in order. */
function messages(request) {
  return request.json.resourceLogs.flatMap(resourceLog =>
    resourceLog.scopeLogs.flatMap(scopeLog =>
      scopeLog.logRecords.map(logRecord => logRecord.body.stringValue)
    )
  )
}

/** Every record body across a list of requests, in order. */
function allMessages(requests) {
  return requests.flatMap(messages)
}

/** A collector and an exporter pointed at it, with short timings. */
async function startExporting(options = {}) {
  const collector = await startCollector()
  const exporter = createOtlpExporter({
    endpoint: `${collector.origin}/i/v1/logs`,
    headers: { Authorization: 'Bearer test-key' },
    resource: { 'service.name': 'test' },
    flushIntervalMs: 60_000,
    initialBackoffMs: 20,
    maxBackoffMs: 80,
    requestTimeoutMs: 2_000,
    ...options,
  })

  return {
    collector,
    exporter,
    async close() {
      await exporter.shutdown(2_000)
      await collector.close()
    },
  }
}

/** Waits so a timer has a chance to fire when the test expects it not to. */
function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('toOtlpValue', () => {
  test('encodes a string, a boolean, an integer and a float', () => {
    assert.deepEqual(toOtlpValue('text'), { stringValue: 'text' })
    assert.deepEqual(toOtlpValue(true), { boolValue: true })
    assert.deepEqual(toOtlpValue(0), { intValue: '0' })
    assert.deepEqual(toOtlpValue(42), { intValue: '42' })
    assert.deepEqual(toOtlpValue(1.5), { doubleValue: 1.5 })
  })

  test('writes only safe integers as intValue', () => {
    assert.deepEqual(toOtlpValue(Number.MAX_SAFE_INTEGER), {
      intValue: '9007199254740991',
    })
    assert.deepEqual(toOtlpValue(Number.MAX_SAFE_INTEGER + 1), {
      doubleValue: 9_007_199_254_740_992,
    })
  })

  test('encodes an array of mixed values', () => {
    assert.deepEqual(toOtlpValue(['a', 1, true, 2.5]), {
      arrayValue: {
        values: [
          { stringValue: 'a' },
          { intValue: '1' },
          { boolValue: true },
          { doubleValue: 2.5 },
        ],
      },
    })
  })
})

describe('buildPayload', () => {
  test('builds the exact OTLP payload for one record', () => {
    assert.deepEqual(
      buildPayload(
        [
          {
            time: new Date(1_767_225_600_000),
            level: 'info',
            message: 'Notification delivered.',
            attributes: { 'notification.source': 'ci' },
          },
        ],
        { 'service.name': 'shion' }
      ),
      {
        resourceLogs: [
          {
            resource: {
              attributes: [{ key: 'service.name', value: { stringValue: 'shion' } }],
            },
            scopeLogs: [
              {
                scope: { name: '@4lch4/logger' },
                logRecords: [
                  {
                    timeUnixNano: '1767225600000000000',
                    observedTimeUnixNano: '1767225600000000000',
                    severityNumber: 9,
                    severityText: 'INFO',
                    body: { stringValue: 'Notification delivered.' },
                    attributes: [{ key: 'notification.source', value: { stringValue: 'ci' } }],
                  },
                ],
              },
            ],
          },
        ],
      }
    )
  })

  test('writes OTLP severity numbers for every level', () => {
    const expected = { debug: 5, info: 9, warn: 13, error: 17 }

    for (const [level, severityNumber] of Object.entries(expected)) {
      const payload = buildPayload([record('Level.', { level })], {})
      const logRecord = payload.resourceLogs[0].scopeLogs[0].logRecords[0]

      assert.equal(logRecord.severityNumber, severityNumber)
      assert.equal(logRecord.severityText, level.toUpperCase())
    }
  })

  test('turns an error attribute into exception attributes', () => {
    const error = new TypeError('Delivery failed.')
    const payload = buildPayload(
      [record('Failed.', { attributes: { subject: 'models', error } })],
      {}
    )

    assert.deepEqual(payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes, [
      { key: 'subject', value: { stringValue: 'models' } },
      { key: 'exception.type', value: { stringValue: 'TypeError' } },
      { key: 'exception.message', value: { stringValue: 'Delivery failed.' } },
      { key: 'exception.stacktrace', value: { stringValue: error.stack } },
    ])
  })

  test('uses the current time when a record time is invalid', () => {
    const before = Date.now()
    const payload = buildPayload([record('Bad time.', { time: new Date('nope') })], {})
    const after = Date.now()
    const logRecord = payload.resourceLogs[0].scopeLogs[0].logRecords[0]
    const millis = Number(BigInt(logRecord.timeUnixNano) / 1_000_000n)

    assert.ok(millis >= before && millis <= after, `The time was ${millis} ms.`)
    assert.equal(logRecord.observedTimeUnixNano, logRecord.timeUnixNano)
  })
})

describe('createOtlpExporter', () => {
  describe('sending', () => {
    test('posts JSON to the endpoint with the configured headers', async () => {
      const context = await startExporting({ headers: { Authorization: 'Bearer secret' } })

      try {
        context.exporter.enqueue(record('Posted.'))
        await context.exporter.flush()

        assert.equal(context.collector.requests.length, 1)

        const request = context.collector.requests[0]

        assert.equal(request.method, 'POST')
        assert.equal(request.url, '/i/v1/logs')
        assert.equal(request.headers['content-type'], 'application/json')
        assert.equal(request.headers.authorization, 'Bearer secret')
        assert.deepEqual(messages(request), ['Posted.'])
      } finally {
        await context.close()
      }
    })

    test('sends a queued record on the interval without flush', async () => {
      const context = await startExporting({ flushIntervalMs: 25 })

      try {
        const started = Date.now()

        context.exporter.enqueue(record('Timed.'))

        const request = await waitFor(() => context.collector.requests[0])

        assert.ok(Date.now() - started >= 20, 'The record was sent before the interval.')
        assert.deepEqual(messages(request), ['Timed.'])
      } finally {
        await context.close()
      }
    })

    test('sends a full batch without waiting for the interval', async () => {
      const context = await startExporting({ maxBatchRecords: 5 })

      try {
        for (let index = 0; index < 5; index++) context.exporter.enqueue(record(`Full ${index}.`))

        const request = await waitFor(() => context.collector.requests[0])

        assert.deepEqual(messages(request), ['Full 0.', 'Full 1.', 'Full 2.', 'Full 3.', 'Full 4.'])
      } finally {
        await context.close()
      }
    })

    test('splits 250 records into batches of 100, 100 and 50 in order', async () => {
      const context = await startExporting()

      try {
        for (let index = 0; index < 250; index++) {
          context.exporter.enqueue(record(`Ordered ${index}.`))
        }

        await context.exporter.flush()

        assert.deepEqual(
          context.collector.requests.map(request => messages(request).length),
          [100, 100, 50]
        )
        assert.deepEqual(
          allMessages(context.collector.requests),
          Array.from({ length: 250 }, (_, index) => `Ordered ${index}.`)
        )
      } finally {
        await context.close()
      }
    })
  })

  describe('limits', () => {
    test('keeps every body under maxRequestBytes and every record in order', async () => {
      const context = await startExporting({ maxRequestBytes: 600 })

      try {
        const written = Array.from(
          { length: 10 },
          (_, index) => `Message ${index} ${'x'.repeat(100)}`
        )

        for (const message of written) context.exporter.enqueue(record(message))

        await context.exporter.flush()

        assert.ok(context.collector.requests.length > 1, 'Everything went in one request.')

        for (const request of context.collector.requests) {
          const bytes = Buffer.byteLength(request.text)

          assert.ok(bytes <= 600, `A request body was ${bytes} bytes.`)
        }

        assert.deepEqual(allMessages(context.collector.requests), written)
      } finally {
        await context.close()
      }
    })

    test('drops one record that is over the limit on its own', async () => {
      const context = await startExporting({ maxRequestBytes: 600 })

      try {
        context.exporter.enqueue(record('Before.'))
        context.exporter.enqueue(record(`Oversized ${'x'.repeat(2_000)}`))
        context.exporter.enqueue(record('After.'))

        await context.exporter.flush()

        assert.deepEqual(allMessages(context.collector.requests), ['Before.', 'After.'])
      } finally {
        await context.close()
      }
    })

    test('caps the queue and reports the records it dropped', async () => {
      const statuses = []
      const context = await startExporting({
        maxBatchRecords: 100,
        initialBackoffMs: 60_000,
        maxBackoffMs: 60_000,
        onStatus: status => statuses.push(status),
      })

      context.collector.respondWith(503)

      try {
        for (let index = 0; index < 100; index++) {
          context.exporter.enqueue(record(`Capped ${index}.`))
        }

        await waitFor(() => statuses.length === 1)

        const failedRequests = context.collector.requests.length

        assert.deepEqual(statuses[0], { state: 'failing', reason: 'HTTP 503' })

        for (let index = 100; index < 1_500; index++) {
          context.exporter.enqueue(record(`Capped ${index}.`))
        }

        context.collector.respondWith(200)
        await context.exporter.flush()

        const delivered = allMessages(context.collector.requests.slice(failedRequests))

        assert.equal(delivered.length, 1_000)
        assert.deepEqual(
          delivered,
          Array.from({ length: 1_000 }, (_, index) => `Capped ${500 + index}.`)
        )
        assert.deepEqual(statuses[1], { state: 'recovered', dropped: 500 })
      } finally {
        await context.close()
      }
    })
  })

  describe('failures', () => {
    test('grows the wait between attempts up to maxBackoffMs', async () => {
      const attempts = []
      const failingFetch = () => {
        attempts.push(Date.now())

        return Promise.reject(new Error('down'))
      }
      const exporter = createOtlpExporter({
        endpoint: 'http://127.0.0.1:1/i/v1/logs',
        headers: {},
        resource: { 'service.name': 'test' },
        fetch: failingFetch,
        flushIntervalMs: 20,
        initialBackoffMs: 40,
        maxBackoffMs: 160,
      })

      try {
        exporter.enqueue(record('Retry.'))

        await waitFor(() => attempts.length >= 5, 5_000)

        const gaps = attempts.slice(1).map((time, index) => time - attempts[index])

        assert.ok(gaps[0] >= 30, `The first gap was ${gaps[0]} ms.`)
        assert.ok(gaps[1] > gaps[0] * 1.2, `The second gap was ${gaps[1]} ms after ${gaps[0]} ms.`)
        assert.ok(gaps[2] > gaps[1] * 1.2, `The third gap was ${gaps[2]} ms after ${gaps[1]} ms.`)
        assert.ok(
          gaps.every(gap => gap <= 260),
          `A gap was over the cap: ${gaps.join(', ')}.`
        )
        assert.ok(attempts.length <= 7, `There were ${attempts.length} attempts.`)
      } finally {
        await exporter.shutdown(1_000)
      }
    })

    test('reports failing once, recovered once, then failing again', async () => {
      const statuses = []
      const context = await startExporting({
        maxBatchRecords: 1,
        initialBackoffMs: 15,
        maxBackoffMs: 15,
        onStatus: status => statuses.push(status),
      })

      context.collector.respondWith(503)

      try {
        context.exporter.enqueue(record('First.'))

        await waitFor(() => statuses.length === 1)
        await waitFor(() => context.collector.requests.length >= 3)

        assert.deepEqual(statuses, [{ state: 'failing', reason: 'HTTP 503' }])

        context.collector.respondWith(200)
        await context.exporter.flush()

        assert.deepEqual(statuses, [
          { state: 'failing', reason: 'HTTP 503' },
          { state: 'recovered', dropped: 0 },
        ])

        context.collector.respondWith(503)
        context.exporter.enqueue(record('Second.'))
        await context.exporter.flush()

        assert.deepEqual(
          statuses.map(status => status.state),
          ['failing', 'recovered', 'failing']
        )

        context.collector.respondWith(200)
      } finally {
        await context.close()
      }
    })

    test('drops a batch on 400 and never sends it again', async () => {
      const statuses = []
      const context = await startExporting({
        maxBatchRecords: 1,
        initialBackoffMs: 60_000,
        maxBackoffMs: 60_000,
        onStatus: status => statuses.push(status),
      })

      context.collector.respondWith(400)

      try {
        context.exporter.enqueue(record('Bad.'))

        await waitFor(() => statuses.length === 1)
        await context.exporter.flush()
        await pause(50)

        assert.equal(context.collector.requests.length, 1)
        assert.deepEqual(statuses[0], { state: 'failing', reason: 'HTTP 400' })

        context.collector.respondWith(200)
        context.exporter.enqueue(record('Good.'))
        await context.exporter.flush()

        assert.deepEqual(messages(context.collector.requests[1]), ['Good.'])
        assert.deepEqual(statuses[1], { state: 'recovered', dropped: 1 })
      } finally {
        await context.close()
      }
    })

    test('keeps a batch through 503 and 429 until the server recovers', async () => {
      for (const status of [503, 429]) {
        const context = await startExporting({
          maxBatchRecords: 1,
          initialBackoffMs: 60_000,
          maxBackoffMs: 60_000,
        })

        context.collector.respondWith(status)

        try {
          context.exporter.enqueue(record('Kept.'))

          await waitFor(() => context.collector.requests.length === 1)

          context.collector.respondWith(200)
          await context.exporter.flush()

          assert.equal(context.collector.requests.length, 2)
          assert.deepEqual(messages(context.collector.requests[1]), ['Kept.'])
        } finally {
          await context.close()
        }
      }
    })

    test('flush ignores the backoff wait', async () => {
      const context = await startExporting({
        initialBackoffMs: 60_000,
        maxBackoffMs: 60_000,
      })

      context.collector.respondWith(503)

      try {
        context.exporter.enqueue(record('Now.'))
        await context.exporter.flush()

        assert.equal(context.collector.requests.length, 1)

        context.collector.respondWith(200)

        const started = Date.now()

        await context.exporter.flush()

        assert.ok(Date.now() - started < 1_000, 'flush waited for the backoff.')
        assert.equal(context.collector.requests.length, 2)
        assert.deepEqual(messages(context.collector.requests[1]), ['Now.'])
      } finally {
        await context.close()
      }
    })
  })

  describe('shutdown', () => {
    test('resolves on time against a server that never answers', async () => {
      const context = await startExporting({
        flushIntervalMs: 60_000,
        requestTimeoutMs: 60_000,
      })

      context.collector.respondWith(() => new Promise(() => {}))

      try {
        context.exporter.enqueue(record('Hang.'))

        const started = Date.now()

        await context.exporter.shutdown(100)

        const elapsed = Date.now() - started

        assert.ok(elapsed < 900, `shutdown took ${elapsed} ms.`)
        assert.ok(elapsed >= 50, `shutdown returned after ${elapsed} ms.`)
        assert.equal(context.collector.requests.length, 1, 'Nothing was attempted.')

        await context.exporter.shutdown(5_000)

        context.exporter.enqueue(record('Ignored.'))
        await pause(50)

        assert.equal(context.collector.requests.length, 1)
      } finally {
        await context.close()
      }
    })

    test('aborts a request that is still in flight when the time limit passes', async () => {
      /** @type {AbortSignal | undefined} */
      let signal
      const statuses = []
      const exporter = createOtlpExporter({
        endpoint: 'http://127.0.0.1:1/i/v1/logs',
        headers: {},
        resource: {},
        onStatus: status => statuses.push(status),
        fetch(_url, init) {
          signal = init.signal

          return new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(init.signal.reason))
          })
        },
        flushIntervalMs: 60_000,
        requestTimeoutMs: 60_000,
      })

      exporter.enqueue(record('Hang.'))
      await exporter.shutdown(50)
      await pause(20)

      assert.equal(signal?.aborted, true)
      assert.deepEqual(statuses, [], 'An aborted request is not a failing server.')
    })
  })

  describe('robustness', () => {
    test('never throws when fetch throws synchronously', async () => {
      const exporter = createOtlpExporter({
        endpoint: 'http://127.0.0.1:1/i/v1/logs',
        headers: {},
        resource: {},
        fetch() {
          throw new Error('Sync boom.')
        },
        initialBackoffMs: 20,
        maxBackoffMs: 20,
        requestTimeoutMs: 100,
      })

      exporter.enqueue(record('Sync.'))

      await exporter.flush()
      await exporter.flush()
      await exporter.shutdown(100)
    })

    test('never throws when onStatus throws', async () => {
      const context = await startExporting({
        maxBatchRecords: 1,
        initialBackoffMs: 20,
        maxBackoffMs: 20,
        onStatus() {
          throw new Error('Status boom.')
        },
      })

      context.collector.respondWith(500)

      try {
        context.exporter.enqueue(record('Status.'))

        await waitFor(() => context.collector.requests.length >= 1)

        await context.exporter.flush()
        await context.exporter.flush()

        context.collector.respondWith(200)
        await context.exporter.flush()

        assert.equal(context.collector.requests.length >= 2, true)
      } finally {
        await context.close()
      }
    })

    test('does not keep the process alive with its timers', async () => {
      const collector = await startCollector()

      try {
        const code = `
          import { createOtlpExporter } from ${JSON.stringify(distUrl('otlp.js'))}

          const exporter = createOtlpExporter({
            endpoint: ${JSON.stringify(`${collector.origin}/i/v1/logs`)},
            headers: {},
            resource: { 'service.name': 'child' },
            flushIntervalMs: 60_000,
          })

          exporter.enqueue({
            time: new Date(),
            level: 'info',
            message: 'Child record.',
            attributes: {},
          })

          // No flush and no shutdown: the process must still exit by itself.
        `
        const started = Date.now()
        const child = await runChild(code, { timeoutMs: 10_000 })

        assert.equal(child.code, 0, child.stderr)
        assert.ok(
          Date.now() - started < 5_000,
          `The child took ${Date.now() - started} ms to exit.`
        )
      } finally {
        await collector.close()
      }
    })
  })
})
