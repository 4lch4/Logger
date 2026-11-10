import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { distUrl } from './helpers.mjs'

const {
  parseKeyValueList,
  resolveConfig,
  resolveFormat,
  resolveLevel,
  resolvePostHog,
  resolveResource,
} = await import(distUrl('config.js'))

describe('parseKeyValueList', () => {
  test('parses comma-separated pairs and percent-decodes the values', () => {
    assert.deepEqual(parseKeyValueList('a=1,b=two%20words'), { a: '1', b: 'two words' })
  })

  test('splits each pair on its first equals sign', () => {
    assert.deepEqual(parseKeyValueList('k=a=b'), { k: 'a=b' })
  })

  test('trims the key and the value', () => {
    assert.deepEqual(parseKeyValueList(' a = 1 , b = 2 '), { a: '1', b: '2' })
  })

  test('decodes the value but not the key', () => {
    assert.deepEqual(parseKeyValueList('a%20b=two%20words'), { 'a%20b': 'two words' })
  })

  test('accepts a bearer token with or without percent-encoding', () => {
    assert.deepEqual(parseKeyValueList('Authorization=Bearer%20phc_x'), {
      Authorization: 'Bearer phc_x',
    })
    assert.deepEqual(parseKeyValueList('Authorization=Bearer phc_x'), {
      Authorization: 'Bearer phc_x',
    })
  })

  test('skips pairs without an equals sign, a key or a value', () => {
    assert.deepEqual(parseKeyValueList('bad, =x, k= ,ok=1'), { ok: '1' })
  })

  test('keeps the raw value when percent-decoding fails', () => {
    assert.deepEqual(parseKeyValueList('k=%E0%A4%A'), { k: '%E0%A4%A' })
  })

  test('keeps the later value when a key appears twice', () => {
    assert.deepEqual(parseKeyValueList('a=1,b=2,a=3'), { a: '3', b: '2' })
  })

  test('treats undefined and an empty string as no pairs', () => {
    assert.deepEqual(parseKeyValueList(undefined), {})
    assert.deepEqual(parseKeyValueList(''), {})
  })
})

describe('resolveLevel', () => {
  test('accepts each level, whatever its case and surrounding spaces', () => {
    for (const level of ['error', 'warn', 'info', 'debug']) {
      assert.equal(resolveLevel({ LOG_LEVEL: level }), level)
      assert.equal(resolveLevel({ LOG_LEVEL: level.toUpperCase() }), level)
      assert.equal(resolveLevel({ LOG_LEVEL: `  ${level}  ` }), level)
    }
  })

  test('defaults to debug outside production', () => {
    assert.equal(resolveLevel({}), 'debug')
    assert.equal(resolveLevel({ NODE_ENV: 'development' }), 'debug')
  })

  test('defaults to info in production', () => {
    assert.equal(resolveLevel({ NODE_ENV: 'production' }), 'info')
  })

  test('falls back to the NODE_ENV default for an unknown or empty level', () => {
    assert.equal(resolveLevel({ LOG_LEVEL: 'trace' }), 'debug')
    assert.equal(resolveLevel({ LOG_LEVEL: 'trace', NODE_ENV: 'production' }), 'info')
    assert.equal(resolveLevel({ LOG_LEVEL: '', NODE_ENV: 'production' }), 'info')
  })
})

describe('resolveFormat', () => {
  test('writes JSON in production, whatever stdout is', () => {
    assert.equal(resolveFormat({ NODE_ENV: 'production' }, true), 'json')
    assert.equal(resolveFormat({ NODE_ENV: 'production' }, false), 'json')
  })

  test('writes JSON when stdout is not a terminal', () => {
    assert.equal(resolveFormat({}, false), 'json')
  })

  test('writes the readable format otherwise', () => {
    assert.equal(resolveFormat({}, true), 'pretty')
    assert.equal(resolveFormat({ NODE_ENV: 'development' }, true), 'pretty')
  })
})

describe('resolveResource', () => {
  test('defaults the environment and leaves service.name absent', () => {
    const resource = resolveResource({}, {})

    assert.deepEqual(resource, { 'deployment.environment.name': 'development' })
    assert.equal('service.name' in resource, false)
  })

  test('uses production when NODE_ENV is production', () => {
    const resource = resolveResource({}, { NODE_ENV: 'production' })

    assert.equal(resource['deployment.environment.name'], 'production')
  })

  test('reads OTEL_RESOURCE_ATTRIBUTES over the NODE_ENV default', () => {
    const resource = resolveResource(
      {},
      {
        NODE_ENV: 'production',
        OTEL_RESOURCE_ATTRIBUTES:
          'deployment.environment.name=staging,service.name=api,custom.key=a%20b',
      }
    )

    assert.deepEqual(resource, {
      'service.name': 'api',
      'deployment.environment.name': 'staging',
      'custom.key': 'a b',
    })
  })

  test('reads OTEL_SERVICE_NAME and VCS_REVISION over OTEL_RESOURCE_ATTRIBUTES', () => {
    const resource = resolveResource(
      {},
      {
        OTEL_RESOURCE_ATTRIBUTES: 'service.name=old,vcs.revision=old',
        OTEL_SERVICE_NAME: 'api',
        VCS_REVISION: 'abc123',
      }
    )

    assert.equal(resource['service.name'], 'api')
    assert.equal(resource['vcs.revision'], 'abc123')
  })

  test("reads the options' attributes over the environment", () => {
    const resource = resolveResource(
      { attributes: { 'service.name': 'from-options', 'vcs.revision': 'from-options', count: 3 } },
      { OTEL_SERVICE_NAME: 'api', VCS_REVISION: 'abc123' }
    )

    assert.equal(resource['service.name'], 'from-options')
    assert.equal(resource['vcs.revision'], 'from-options')
    assert.equal(resource.count, 3)
  })

  test('reads service, version and environment over everything else', () => {
    const resource = resolveResource(
      {
        service: 'api',
        version: '1.2.3',
        environment: 'test',
        attributes: {
          'service.name': 'old',
          'service.version': '0.0.0',
          'deployment.environment.name': 'old',
        },
      },
      { NODE_ENV: 'production', OTEL_SERVICE_NAME: 'old' }
    )

    assert.deepEqual(resource, {
      'service.name': 'api',
      'service.version': '1.2.3',
      'deployment.environment.name': 'test',
    })
  })

  test('ignores empty and whitespace-only values at every step', () => {
    const resource = resolveResource(
      { service: ' ', version: '', environment: '  ' },
      {
        OTEL_SERVICE_NAME: '  ',
        VCS_REVISION: '',
        OTEL_RESOURCE_ATTRIBUTES: 'service.name=,vcs.revision= ',
      }
    )

    assert.deepEqual(resource, { 'deployment.environment.name': 'development' })
  })

  test('converts the attribute values with toAttributeValue', () => {
    const resource = resolveResource(
      { attributes: { date: new Date(0), list: ['a', 1], nothing: undefined } },
      {}
    )

    assert.deepEqual(resource, {
      'deployment.environment.name': 'development',
      date: '1970-01-01T00:00:00.000Z',
      list: ['a', 1],
    })
  })

  test('puts the standard attributes first, in order, then the rest as first seen', () => {
    const resource = resolveResource(
      {
        service: 'api',
        version: '1.2.3',
        attributes: { 'custom.b': 'b', 'custom.a': 'a' },
      },
      {
        VCS_REVISION: 'abc123',
        OTEL_RESOURCE_ATTRIBUTES: 'custom.a=from-env,first=1',
      }
    )

    assert.deepEqual(Object.keys(resource), [
      'service.name',
      'service.version',
      'vcs.revision',
      'deployment.environment.name',
      'custom.a',
      'first',
      'custom.b',
    ])
  })
})

describe('resolvePostHog', () => {
  test('is undefined without an API key, whatever else is set', () => {
    assert.equal(resolvePostHog({}), undefined)
    assert.equal(
      resolvePostHog({ POSTHOG_API_KEY: '', POSTHOG_HOST: 'http://localhost:1234' }),
      undefined
    )
    assert.equal(resolvePostHog({ POSTHOG_API_KEY: '   ' }), undefined)
  })

  test('uses the defaults for the host, endpoint and headers', () => {
    assert.deepEqual(resolvePostHog({ POSTHOG_API_KEY: 'phc_x' }), {
      apiKey: 'phc_x',
      host: 'https://us.i.posthog.com',
      logsEndpoint: 'https://us.i.posthog.com/i/v1/logs',
      logsHeaders: { Authorization: 'Bearer phc_x' },
    })
  })

  test('trims the API key and the host', () => {
    assert.deepEqual(
      resolvePostHog({ POSTHOG_API_KEY: ' phc_x ', POSTHOG_HOST: ' https://ph.example ' }),
      {
        apiKey: 'phc_x',
        host: 'https://ph.example',
        logsEndpoint: 'https://ph.example/i/v1/logs',
        logsHeaders: { Authorization: 'Bearer phc_x' },
      }
    )
  })

  test('removes the trailing slashes from the host', () => {
    const host = resolvePostHog({
      POSTHOG_API_KEY: 'phc_x',
      POSTHOG_HOST: 'http://localhost:1234//',
    })
    const endpoint = resolvePostHog({
      POSTHOG_API_KEY: 'phc_x',
      POSTHOG_HOST: 'http://localhost:1234/',
    })

    assert.equal(host.host, 'http://localhost:1234')
    assert.equal(endpoint.logsEndpoint, 'http://localhost:1234/i/v1/logs')
  })

  test('uses a custom endpoint as given', () => {
    const config = resolvePostHog({
      POSTHOG_API_KEY: 'phc_x',
      OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: ' http://localhost:1234/v1/logs ',
    })

    assert.equal(config.logsEndpoint, 'http://localhost:1234/v1/logs')
  })

  test('uses custom headers instead of the default one', () => {
    const config = resolvePostHog({
      POSTHOG_API_KEY: 'phc_x',
      OTEL_EXPORTER_OTLP_LOGS_HEADERS: 'X-Key=abc,Authorization=Bearer%20other',
    })

    assert.deepEqual(config.logsHeaders, { 'X-Key': 'abc', Authorization: 'Bearer other' })
  })
})

describe('resolveConfig', () => {
  test('leaves posthog out entirely without an API key', () => {
    const config = resolveConfig({ service: 'api' }, {}, false)

    assert.equal('posthog' in config, false)
    assert.equal(config.level, 'debug')
    assert.equal(config.format, 'json')
    assert.deepEqual(config.resource, {
      'service.name': 'api',
      'deployment.environment.name': 'development',
    })
  })

  test('includes posthog when there is an API key', () => {
    const config = resolveConfig({}, { POSTHOG_API_KEY: 'phc_x' }, true)

    assert.equal(config.posthog.apiKey, 'phc_x')
  })

  test('works out the level, format and resource together', () => {
    const config = resolveConfig(
      { version: '1.2.3' },
      { NODE_ENV: 'production', LOG_LEVEL: 'warn' },
      false
    )

    assert.equal(config.level, 'warn')
    assert.equal(config.format, 'json')
    assert.deepEqual(config.resource, {
      'service.version': '1.2.3',
      'deployment.environment.name': 'production',
    })
  })
})
