# @4lch4/logger

A small Winston-based logger for Node.js that writes to the console and, optionally, to
[Axiom](https://axiom.co).

## Requirements

Node.js >= 22.

## Installation

```shell
npm install @4lch4/logger
```

## Usage

The package exports a single, shared logger instance:

```typescript
import { logger } from '@4lch4/logger'

logger.info('Hello, world!')
logger.debug('Some extra detail')
logger.warn('Something looks off')
logger.error('Something broke')
logger.success('It worked')
```

The logger always writes to the console and, when the Axiom environment variables are set, also
sends entries to Axiom.

## Log levels

It uses the npm levels (`error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`) plus a
custom `success` level. `success` has the highest priority, so it is always logged. Console
colors: `success` is green, `info` is cyan, and the rest use Winston's defaults.

## Environment variables

- `LOG_LEVEL` — level to log at. Takes precedence over `NODE_ENV`.
- `NODE_ENV` — when `production`, the default level is `info`; otherwise it is `debug`.
- `LOG_SERVICE`, `API_NAME`, `APP_NAME` — service name added to every entry, checked in that
  order.
- `HOSTNAME` — hostname added to every entry; defaults to `localhost`.
- `AXIOM_DATASET`, `AXIOM_TOKEN` — when both are set, entries are also sent to Axiom.
- `AXIOM_ORG_ID` — Axiom org ID; only needed when using a personal token.

Every entry also includes `service`, `nodeEnv` (default `development`), `hostname`, `arch` and
`platform` metadata.

## Exports

- `logger` — the shared logger instance.
- `Logger` — the logger type, which adds `success` to Winston's `Logger`.
- `ConsoleTransport` — the configured Winston console transport.
- `AxiomTransport(dataset, token, orgId?)` — creates a Winston transport that logs to Axiom.

## License

MIT
