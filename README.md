# @4lch4/logger

Writes every log record as a line on stdout, sends the same record to PostHog Logs over OTLP/HTTP
with JSON, and sends errors to PostHog's error tracking through `posthog-node`. It implements the
logging convention in
[Deploy-Methods](https://github.com/4lch4/Deploy-Methods/blob/main/logging/README.md).

## Requirements

Node.js 24 or newer (26 preferred), or Bun 1.4.4 or newer. The package is ESM only.

## Installation

```shell
npm install @4lch4/logger
bun add @4lch4/logger
```

## Usage

```ts
import { createLogger } from '@4lch4/logger'
import pkg from './package.json' with { type: 'json' }

const logger = createLogger({ version: pkg.version })

logger.info('Notification delivered.', {
  'notification.source': 'ci',
  'delivery.delivered_to': '#ci',
})

try {
  await deliver()
} catch (error) {
  logger.error('Delivery failed.', { error, 'delivery.channel': '#ci' })
}

const child = logger.child({ subject: "OpenCode's models" })
child.info('Model listed.')

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    await logger.shutdown()
    process.exit(0)
  })
}
```

**The library installs no signal handlers.** The app must call `shutdown()` from its own SIGTERM
and SIGINT handling, or records queued for PostHog are lost.

For small apps, the default `logger` export is built from the environment alone, on first use:

```ts
import { logger } from '@4lch4/logger'

logger.info('Started.')
```

## Levels

| Level   | Use it for                                              |
| ------- | ------------------------------------------------------- |
| `error` | A person or agent must act.                             |
| `warn`  | Degraded, but recovered or worked around.               |
| `info`  | State changes such as startup, shutdown and deliveries. |
| `debug` | Detail for development. Never in production.            |

Only an `error` record with an `error` attribute creates an exception in PostHog. On `warn` and
lower, the `error` only becomes `exception.*` attributes.

## Attributes

An attribute value is a string, number or boolean, or an array of those. Keys are dotted. A value
of `undefined` is left out, and a nested object is a compile error.

`error` takes anything that was thrown or rejected, and it is written as `exception.type`,
`exception.message` and `exception.stacktrace`.

Keep messages stable and put changing values in attributes, so one bug always groups as one issue:

```ts
logger.error('Delivery failed.', { 'delivery.channel': '#ci' })
```

## Resource attributes

Every record and every exception carries these, with dotted keys:

| Attribute                     | Source, in order of precedence                             |
| ----------------------------- | ---------------------------------------------------------- |
| `service.name`                | `service`, `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` |
| `service.version`             | `version`, `OTEL_RESOURCE_ATTRIBUTES`                      |
| `vcs.revision`                | `VCS_REVISION`, `OTEL_RESOURCE_ATTRIBUTES`                 |
| `deployment.environment.name` | `environment`, `OTEL_RESOURCE_ATTRIBUTES`                  |

`service`, `version` and `environment` are options to `createLogger`; every other name in the
table is an environment variable. With none of them, `deployment.environment.name` is `production`
when `NODE_ENV=production` and `development` otherwise. An attribute with no value is left out
rather than sent as an empty string. `OTEL_RESOURCE_ATTRIBUTES` is comma-separated `key=value`
pairs, percent-decoded, as OpenTelemetry defines it.

Usually the image sets `OTEL_SERVICE_NAME` and `VCS_REVISION`, the code passes `version`, and the
deployment's `.env` sets `OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=production`.

## Configuration

| Variable                           | Use                                                      |
| ---------------------------------- | -------------------------------------------------------- |
| `POSTHOG_API_KEY`                  | Project key (`phc_…`). Unset means stdout only.          |
| `POSTHOG_HOST`                     | Default `https://us.i.posthog.com`.                      |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | Default `${POSTHOG_HOST}/i/v1/logs`.                     |
| `OTEL_EXPORTER_OTLP_LOGS_HEADERS`  | `key=value` pairs. Default `Authorization=Bearer <key>`. |
| `OTEL_SERVICE_NAME`                | `service.name`.                                          |
| `OTEL_RESOURCE_ATTRIBUTES`         | Comma-separated `key=value` pairs.                       |
| `VCS_REVISION`                     | `vcs.revision`.                                          |
| `LOG_LEVEL`                        | `error`, `warn`, `info` or `debug`.                      |
| `NODE_ENV`                         | Defaults for level, stdout and environment.              |

Without `POSTHOG_API_KEY`, the logger writes to stdout only, so local development and tests need
no PostHog account. The `OTEL_*` names are OpenTelemetry's standard ones.

`LOG_LEVEL` defaults to `info` when `NODE_ENV=production` and `debug` otherwise. `NODE_ENV` also
switches stdout to JSON and sets the default `deployment.environment.name` to `production`.

## Output on stdout

When `NODE_ENV=production`, or stdout isn't a terminal, each record is one JSON object per line:
`time`, `level`, `message`, the resource attributes, then the record's attributes.

<!-- prettier-ignore -->
```json
{"time":"2026-11-09T20:01:02.345Z","level":"info","message":"Started.","service.name":"shion"}
```

Otherwise it is one readable line:

```text
12:01:02 INFO  Notification delivered. notification.source=ci delivery.delivered_to=#ci
```

stdout gets every record at or above `LOG_LEVEL`, whatever happens to PostHog.

## Errors and crashes

An `error` record with an `error` attribute is also sent with `captureException`. It carries the
resource attributes, the record's other attributes and `$process_person_profile: false`. Its
`distinct_id` is `service.name`, so an issue's "users affected" reads as "apps affected", or
`unknown_service` when nothing names the service.

When `POSTHOG_API_KEY` is set, uncaught exceptions and unhandled rejections are written as an
`error` record, captured and flushed within about 5 seconds, and then the process exits with code
1 as it would have anyway. If the app has its own `uncaughtException` or `unhandledRejection`
listener, the library records the error and leaves exiting to the app.

## When PostHog can't be reached

PostHog being slow, down or over quota never blocks, throws or delays the app.

- At most 1,000 records are queued, and the oldest are dropped past that.
- Records are sent every 5 seconds or every 100 records, in requests under 2 MiB.
- Failed requests are retried with exponential backoff capped at one minute. Network errors, HTTP
  429 and 5xx are retried; other 4xx responses drop that batch.
- Sending writes one `warn` line to stdout when it starts failing and one `info` line when it
  recovers, never one per record.

## Flushing and shutdown

`flush()` and `shutdown()` return promises that never reject. `shutdown()` flushes both channels
with a time limit of about 5 seconds, and it is safe to call twice. After it, records still go to
stdout.

## Testing

`createTestLogger()` returns a logger that sends nothing and writes nothing, plus a `records`
array. Each record has `time`, `level`, `message` and `attributes`, oldest first. Child loggers
write to the same array with their attributes merged in.

```ts
import { createTestLogger } from '@4lch4/logger'
import assert from 'node:assert/strict'

const logger = createTestLogger()

logger.child({ subject: 'models' }).info('Model listed.')

assert.equal(logger.records.length, 1)
assert.equal(logger.records[0].level, 'info')
assert.equal(logger.records[0].attributes.subject, 'models')
```

## Upgrading from 2.x

3.0.0 is a breaking rewrite. Dropped:

- Winston, `@axiomhq/winston`, `ConsoleTransport` and `AxiomTransport`.
- The `success` level, and the npm levels `http`, `verbose` and `silly`.
- `LOG_SERVICE`, `API_NAME`, `APP_NAME`, `HOSTNAME` and `AXIOM_*`.

| 2.x                                   | 3.0.0                                              |
| ------------------------------------- | -------------------------------------------------- |
| `logger.success(...)`                 | `logger.info(...)`                                 |
| `LOG_SERVICE`, `API_NAME`, `APP_NAME` | `OTEL_SERVICE_NAME` or `createLogger({ service })` |
| Metadata objects                      | Flat dotted attributes                             |
| `logger.error(err)`                   | `logger.error('Message.', { error: err })`         |

The minimum Node.js version is now 24. Apps that can't move stay on `^2`.

## License

MIT
