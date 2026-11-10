import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { distUrl } from './helpers.mjs'

const { createStdoutWriter, formatJson, formatPretty } = await import(distUrl('stdout.js'))

/** The local time of day, as `formatPretty` writes it. */
function clockOf(date) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(part => String(part).padStart(2, '0'))
    .join(':')
}

/** A record at the given time, with the rest filled in for tests that don't care about it. */
function recordAt(time, overrides = {}) {
  return { time, level: 'info', message: 'Started.', attributes: {}, ...overrides }
}

describe('formatJson', () => {
  test('writes time, level and message first, then the resource and the attributes', () => {
    const record = {
      time: new Date('2026-01-02T03:04:05.678Z'),
      level: 'info',
      message: 'Started.',
      attributes: { 'app.name': 'shion', count: 2 },
    }
    const line = formatJson(record, { 'service.name': 'api', 'service.version': '1.2.3' })
    const parsed = JSON.parse(line)

    assert.deepEqual(Object.keys(parsed), [
      'time',
      'level',
      'message',
      'service.name',
      'service.version',
      'app.name',
      'count',
    ])
    assert.equal(parsed.time, '2026-01-02T03:04:05.678Z')
    assert.equal(parsed.level, 'info')
    assert.equal(parsed.message, 'Started.')
    assert.equal(parsed.count, 2)
  })

  test('renames a record attribute that takes a reserved name', () => {
    const record = {
      time: new Date(0),
      level: 'warn',
      message: 'Careful.',
      attributes: {
        time: 'attribute time',
        level: 'attribute level',
        message: 'attribute message',
        ok: 1,
      },
    }
    const parsed = JSON.parse(formatJson(record, {}))

    assert.equal(parsed.time, '1970-01-01T00:00:00.000Z')
    assert.equal(parsed.level, 'warn')
    assert.equal(parsed.message, 'Careful.')
    assert.equal(parsed['attribute.time'], 'attribute time')
    assert.equal(parsed['attribute.level'], 'attribute level')
    assert.equal(parsed['attribute.message'], 'attribute message')
    assert.equal(parsed.ok, 1)
  })

  test('leaves out a record attribute that clashes with a resource attribute', () => {
    const record = {
      time: new Date(0),
      level: 'info',
      message: 'Started.',
      attributes: { 'service.name': 'record', other: 'kept' },
    }
    const parsed = JSON.parse(formatJson(record, { 'service.name': 'resource' }))

    assert.equal(parsed['service.name'], 'resource')
    assert.equal(parsed.other, 'kept')
    assert.equal('attribute.service.name' in parsed, false)
  })

  test('writes an error attribute as the exception attributes', () => {
    const error = new Error('Boom.')
    const record = {
      time: new Date(0),
      level: 'error',
      message: 'Failed.',
      attributes: { error, subject: 'models' },
    }
    const line = formatJson(record, {})
    const parsed = JSON.parse(line)

    assert.equal(parsed['exception.type'], 'Error')
    assert.equal(parsed['exception.message'], 'Boom.')
    assert.equal(parsed['exception.stacktrace'], error.stack)
    assert.equal(parsed.subject, 'models')
    assert.equal('error' in parsed, false)
    assert.equal(line.includes('\n'), false)
  })

  test('uses the current time when the record time is invalid', () => {
    const before = Date.now()
    const parsed = JSON.parse(formatJson(recordAt(new Date('not a date')), {}))
    const written = Date.parse(parsed.time)

    assert.ok(written >= before - 1000)
    assert.ok(written <= Date.now() + 1000)
  })

  test('never throws when a record cannot be serialized', () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('No.')
        },
      }
    )
    const line = formatJson(recordAt(new Date(0), { attributes: hostile }), {})

    assert.deepEqual(Object.keys(JSON.parse(line)), ['time', 'level', 'message'])
  })
})

describe('formatPretty', () => {
  test('writes the time, the padded level and the message, then the attributes', () => {
    const time = new Date(2026, 0, 2, 12, 1, 2)
    const line = formatPretty({
      time,
      level: 'info',
      message: 'Notification delivered.',
      attributes: { 'notification.source': 'ci', 'delivery.delivered_to': '#ci' },
    })

    assert.equal(
      line,
      `${clockOf(time)} INFO  Notification delivered. notification.source=ci delivery.delivered_to=#ci`
    )
  })

  test('pads each level to five characters', () => {
    const time = new Date(2026, 0, 2, 0, 0, 0)
    const levels = [
      ['error', 'ERROR'],
      ['warn', 'WARN '],
      ['info', 'INFO '],
      ['debug', 'DEBUG'],
    ]

    for (const [level, text] of levels) {
      assert.ok(formatPretty(recordAt(time, { level })).startsWith(`${clockOf(time)} ${text} `))
    }
  })

  test('quotes values with whitespace, quotes or an equals sign, and writes the rest bare', () => {
    const time = new Date(2026, 0, 2, 0, 0, 0)
    const line = formatPretty({
      time,
      level: 'debug',
      message: 'Values.',
      attributes: {
        plain: 'value',
        spaces: 'two words',
        empty: '',
        equals: 'a=b',
        quote: 'say "hi"',
        number: 3,
        boolean: false,
        list: ['a', 'b'],
      },
    })

    assert.equal(
      line,
      `${clockOf(time)} DEBUG Values. plain=value spaces="two words" empty="" equals="a=b" quote="say \\"hi\\"" number=3 boolean=false list=["a","b"]`
    )
  })

  test('indents a stack trace under the line', () => {
    const error = new Error('Boom.')
    const time = new Date(2026, 0, 2, 3, 4, 5)
    const line = formatPretty({
      time,
      level: 'error',
      message: 'Failed.',
      attributes: { error },
    })
    const [first, ...rest] = line.split('\n')

    assert.equal(
      first,
      `${clockOf(time)} ERROR Failed. exception.type=Error exception.message=Boom.`
    )
    assert.equal(rest.map(part => part.slice(4)).join('\n'), error.stack)
    assert.ok(rest.every(part => part.startsWith('    ')))
  })

  test('has no escape codes without color', () => {
    const line = formatPretty(recordAt(new Date(0), { attributes: { source: 'ci' } }))

    assert.equal(line.includes('\x1b'), false)
  })

  test('colors the level and dims the attribute keys when asked', () => {
    const time = new Date(2026, 0, 2, 0, 0, 0)
    const colors = {
      error: '\x1b[31m',
      warn: '\x1b[33m',
      info: '\x1b[36m',
      debug: '\x1b[90m',
    }

    for (const [level, color] of Object.entries(colors)) {
      const line = formatPretty(recordAt(time, { level, attributes: { source: 'ci' } }), {
        color: true,
      })

      assert.ok(
        line.startsWith(`${clockOf(time)} ${color}${level.toUpperCase().padEnd(5)}\x1b[0m `)
      )
      assert.ok(line.includes('\x1b[2msource=\x1b[0mci'))
    }
  })
})

describe('createStdoutWriter', () => {
  test('calls write once per record, with a trailing newline', () => {
    const written = []
    const writer = createStdoutWriter({
      format: 'json',
      resource: { 'service.name': 'api' },
      write: text => written.push(text),
    })

    writer(recordAt(new Date(0)))
    writer(recordAt(new Date(0), { message: 'Stopped.' }))

    assert.equal(written.length, 2)
    assert.equal(written[0].endsWith('\n'), true)
    assert.equal(written[0].slice(0, -1).includes('\n'), false)
    assert.equal(JSON.parse(written[0]).message, 'Started.')
    assert.equal(JSON.parse(written[1]).message, 'Stopped.')
  })

  test('writes the readable format when asked, without color', () => {
    const time = new Date(2026, 0, 2, 0, 0, 0)
    const written = []
    const writer = createStdoutWriter({
      format: 'pretty',
      resource: { 'service.name': 'api' },
      color: false,
      write: text => written.push(text),
    })

    writer(recordAt(time))

    assert.equal(written.length, 1)
    assert.equal(written[0].includes('\x1b'), false)
    assert.equal(written[0], `${clockOf(time)} INFO  Started.\n`)
  })

  test('never throws when write throws', () => {
    const writer = createStdoutWriter({
      format: 'json',
      resource: {},
      write() {
        throw new Error('EPIPE')
      },
    })

    assert.doesNotThrow(() => writer(recordAt(new Date(0))))
  })
})
