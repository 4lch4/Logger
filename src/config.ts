import { toAttributeValue } from './attributes.js'
import { LEVELS } from './types.js'
import type {
  AttributeValue,
  Config,
  Level,
  LoggerOptions,
  PostHogConfig,
  Resource,
  StdoutFormat,
} from './types.js'

/** Environment variables, as `process.env` holds them. */
export type Env = Readonly<Record<string, string | undefined>>

/** PostHog's US ingestion host, used when `POSTHOG_HOST` is unset. */
const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'

/** The resource attributes that come first, in this order, when they have a value. */
const LEADING_RESOURCE_KEYS = [
  'service.name',
  'service.version',
  'vcs.revision',
  'deployment.environment.name',
] as const

/** Reads an environment variable as a string, ignoring anything else it may hold. */
function readEnv(env: Env, name: string): string | undefined {
  const value: unknown = env[name]

  return typeof value === 'string' ? value : undefined
}

/** Whether the value is one of the four levels. */
function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value)
}

/** Percent-decodes a value, keeping it as it is when the encoding isn't valid. */
function decodeValue(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Removes every trailing slash from a URL. */
function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '')
}

/**
 * Turns a value into a resource attribute value, or `undefined` when it counts as absent: an
 * `undefined` or `null` value, a string that is empty or only whitespace, or an empty array.
 *
 * @param value The value to convert, usually from the environment or the options.
 * @returns The value as a resource attribute value, trimmed, or `undefined` when it's absent.
 */
function toResourceValue(value: unknown): AttributeValue | undefined {
  const converted = toAttributeValue(value)

  if (converted === undefined) return undefined

  if (typeof converted === 'string') {
    const trimmed = converted.trim()

    return trimmed === '' ? undefined : trimmed
  }

  if (Array.isArray(converted)) return converted.length === 0 ? undefined : converted

  return converted
}

/**
 * Parses OpenTelemetry's list format, used by `OTEL_RESOURCE_ATTRIBUTES` and
 * `OTEL_EXPORTER_OTLP_LOGS_HEADERS`: comma-separated `key=value` pairs, with the values
 * percent-decoded. A pair without an `=`, an empty key or an empty value is skipped, and a key
 * that appears twice keeps its last value.
 *
 * @param value The list, such as `a=1,b=two%20words`.
 * @returns The pairs, with the keys and values trimmed.
 */
export function parseKeyValueList(value: string | undefined): Record<string, string> {
  const entries: Record<string, string> = {}

  if (typeof value !== 'string' || value === '') return entries

  for (const pair of value.split(',')) {
    const separator = pair.indexOf('=')

    if (separator === -1) continue

    const key = pair.slice(0, separator).trim()
    const rawValue = pair.slice(separator + 1).trim()

    if (key === '' || rawValue === '') continue

    entries[key] = decodeValue(rawValue)
  }

  return entries
}

/**
 * Works out the level records are written at. `LOG_LEVEL` wins when it names a level, whatever
 * its case and surrounding whitespace; otherwise it's `info` in production and `debug` anywhere
 * else.
 *
 * @param env The environment to read.
 * @returns The level.
 */
export function resolveLevel(env: Env): Level {
  const requested = readEnv(env, 'LOG_LEVEL')?.trim().toLowerCase()

  if (requested !== undefined && isLevel(requested)) return requested

  return env.NODE_ENV === 'production' ? 'info' : 'debug'
}

/**
 * Works out how stdout is written: JSON when `NODE_ENV` is `production` or stdout isn't a
 * terminal, and the readable format otherwise.
 *
 * @param env The environment to read.
 * @param stdoutIsTTY Whether stdout is a terminal.
 * @returns The stdout format.
 */
export function resolveFormat(env: Env, stdoutIsTTY: boolean): StdoutFormat {
  return env.NODE_ENV === 'production' || !stdoutIsTTY ? 'json' : 'pretty'
}

/**
 * Works out the resource attributes that go on every record and exception. Later sources win:
 * the `NODE_ENV` default, `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_SERVICE_NAME` and `VCS_REVISION`, the
 * options' extra attributes, and finally `service`, `version` and `environment`. An absent,
 * empty or whitespace-only value never overrides anything.
 *
 * @param options The logger's options.
 * @param env The environment to read.
 * @returns The resource attributes, with the four standard ones first when they have a value.
 */
export function resolveResource(options: LoggerOptions, env: Env): Resource {
  try {
    const values = new Map<string, AttributeValue>()

    const set = (key: string, value: unknown): void => {
      const resourceValue = toResourceValue(value)

      if (resourceValue !== undefined) values.set(key, resourceValue)
    }

    set('deployment.environment.name', env.NODE_ENV === 'production' ? 'production' : 'development')

    const fromEnvironment = parseKeyValueList(readEnv(env, 'OTEL_RESOURCE_ATTRIBUTES'))

    for (const [key, value] of Object.entries(fromEnvironment)) set(key, value)

    set('service.name', readEnv(env, 'OTEL_SERVICE_NAME'))
    set('vcs.revision', readEnv(env, 'VCS_REVISION'))

    for (const [key, value] of Object.entries(options.attributes ?? {})) set(key, value)

    set('service.name', options.service)
    set('service.version', options.version)
    set('deployment.environment.name', options.environment)

    const resource: Resource = {}

    for (const key of LEADING_RESOURCE_KEYS) {
      const value = values.get(key)

      if (value !== undefined) {
        resource[key] = value
        values.delete(key)
      }
    }

    for (const [key, value] of values) resource[key] = value

    return resource
  } catch {
    return {}
  }
}

/**
 * Works out where to send to PostHog, or `undefined` when `POSTHOG_API_KEY` is unset or empty
 * (stdout only). The host defaults to PostHog's US host without a trailing slash, the logs
 * endpoint to the host's `/i/v1/logs`, and the headers to a bearer token holding the API key.
 *
 * @param env The environment to read.
 * @returns The PostHog configuration, or `undefined` when nothing should be sent.
 */
export function resolvePostHog(env: Env): PostHogConfig | undefined {
  const apiKey = readEnv(env, 'POSTHOG_API_KEY')?.trim()

  if (apiKey === undefined || apiKey === '') return undefined

  const configuredHost = readEnv(env, 'POSTHOG_HOST')?.trim()
  const host = stripTrailingSlashes(configuredHost || DEFAULT_POSTHOG_HOST) || DEFAULT_POSTHOG_HOST
  const configuredEndpoint = readEnv(env, 'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT')?.trim()
  const logsEndpoint = configuredEndpoint ? configuredEndpoint : `${host}/i/v1/logs`
  const headers = parseKeyValueList(readEnv(env, 'OTEL_EXPORTER_OTLP_LOGS_HEADERS'))

  return {
    apiKey,
    host,
    logsEndpoint,
    logsHeaders: Object.keys(headers).length > 0 ? headers : { Authorization: `Bearer ${apiKey}` },
  }
}

/**
 * Works out everything a logger needs from its options and the environment. The result leaves
 * `posthog` out entirely when there is no API key, so `'posthog' in config` tells whether
 * anything is sent.
 *
 * @param options The logger's options.
 * @param env The environment to read. Defaults to `process.env`.
 * @param stdoutIsTTY Whether stdout is a terminal. Defaults to `process.stdout.isTTY`.
 * @returns The configuration.
 */
export function resolveConfig(
  options: LoggerOptions = {},
  env: Env = process.env,
  stdoutIsTTY: boolean = Boolean(process.stdout.isTTY)
): Config {
  const config: Config = {
    level: resolveLevel(env),
    format: resolveFormat(env, stdoutIsTTY),
    resource: resolveResource(options, env),
  }

  const posthog = resolvePostHog(env)

  if (posthog !== undefined) config.posthog = posthog

  return config
}
