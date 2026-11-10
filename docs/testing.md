# Testing

How to test an app that uses `@4lch4/logger`. Setup and configuration are in the
[README](../README.md).

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
