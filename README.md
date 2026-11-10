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

An attribute value is a string, number or boolean, or an array of those. Use OpenTelemetry's name
for a key where one exists (`http.route`), and a dotted name of your own otherwise
(`notification.source`). A value of `undefined` is left out, and a nested object is a compile
error.

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

## More documentation

- [Behavior](docs/behavior.md): output on stdout, errors and crashes, what happens when PostHog
  can't be reached, and flushing and shutdown.
- [Testing](docs/testing.md): asserting on records with `createTestLogger()`.

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
