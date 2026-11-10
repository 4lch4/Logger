import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { distUrl } from './helpers.mjs'

const { describeError, flattenAttributes, toAttributeValue } = await import(
  distUrl('attributes.js')
)

describe('describeError', () => {
  test('describes an Error by its name, message and stack', () => {
    const error = new TypeError('Nope.')
    const description = describeError(error)

    assert.equal(description.type, 'TypeError')
    assert.equal(description.message, 'Nope.')
    assert.equal(description.stacktrace, error.stack)
  })

  test('adds the stack of each cause', () => {
    const cause = new RangeError('Too big.')
    const description = describeError(new Error('Failed.', { cause }))

    assert.match(description.stacktrace, /Error: Failed\./)
    assert.match(description.stacktrace, /\nCaused by: RangeError: Too big\./)
  })

  test('stops following a chain of causes that loops', () => {
    const error = new Error('Loop.')

    error.cause = error

    assert.equal(describeError(error).type, 'Error')
  })

  test('describes thrown values that are not errors', () => {
    assert.deepEqual(describeError('boom'), { type: 'string', message: 'boom' })
    assert.deepEqual(describeError(42), { type: 'number', message: '42' })
    assert.deepEqual(describeError(null), { type: 'null', message: 'null' })
    assert.deepEqual(describeError({ code: 'E_FAIL' }), {
      type: 'object',
      message: '{"code":"E_FAIL"}',
    })
  })

  test('never throws', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('No.')
        },
        has() {
          throw new Error('No.')
        },
      }
    )

    assert.equal(typeof describeError(hostile).message, 'string')
  })
})

describe('toAttributeValue', () => {
  test('keeps valid values as they are', () => {
    assert.equal(toAttributeValue('a'), 'a')
    assert.equal(toAttributeValue(1.5), 1.5)
    assert.equal(toAttributeValue(false), false)
    assert.deepEqual(toAttributeValue(['a', 1, true]), ['a', 1, true])
  })

  test('leaves out undefined and null', () => {
    assert.equal(toAttributeValue(undefined), undefined)
    assert.equal(toAttributeValue(null), undefined)
  })

  test('converts values that got past the types', () => {
    assert.equal(toAttributeValue(Number.NaN), 'NaN')
    assert.equal(toAttributeValue(10n), '10')
    assert.equal(toAttributeValue(new Date(0)), '1970-01-01T00:00:00.000Z')
    assert.equal(toAttributeValue({ a: 1 }), '{"a":1}')
    assert.deepEqual(toAttributeValue([{ a: 1 }, null]), ['{"a":1}', 'null'])
  })
})

describe('flattenAttributes', () => {
  test('drops undefined values and keeps the rest', () => {
    assert.deepEqual(flattenAttributes({ a: 'x', b: undefined, c: [1, 2] }), {
      a: 'x',
      c: [1, 2],
    })
  })

  test('turns error into exception attributes', () => {
    const error = new Error('Failed.')

    assert.deepEqual(flattenAttributes({ subject: 'models', error }), {
      subject: 'models',
      'exception.type': 'Error',
      'exception.message': 'Failed.',
      'exception.stacktrace': error.stack,
    })
  })

  test("keeps an exception attribute the caller set, and never returns an 'error' key", () => {
    const flat = flattenAttributes({ 'exception.type': 'Custom', error: new Error('Failed.') })

    assert.equal(flat['exception.type'], 'Custom')
    assert.equal(flat['exception.message'], 'Failed.')
    assert.equal('error' in flat, false)
  })

  test('ignores an error that is undefined or null', () => {
    assert.deepEqual(flattenAttributes({ a: 1, error: undefined }), { a: 1 })
    assert.deepEqual(flattenAttributes({ a: 1, error: null }), { a: 1 })
  })
})
