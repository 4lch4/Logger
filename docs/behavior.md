# Behavior

What `@4lch4/logger` writes to stdout, what it sends to PostHog, and what it does when
PostHog can't be reached. Setup and configuration are in the [README](../README.md).

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
`distinct_id` is `service.name`, so an issue's "users affected" reads as "apps affected".

When `POSTHOG_API_KEY` is set and nothing names the service, the `distinct_id` is
`unknown_service` and the logger writes one `warn` line to stdout, `No service name is set.`

When `POSTHOG_API_KEY` is set, uncaught exceptions and unhandled rejections are written as an
`error` record, captured and flushed within about 5 seconds, and then the process exits with code
1 as it would have anyway. If the app has its own `uncaughtException` or `unhandledRejection`
listener, the library records the error and leaves exiting to the app.

One limit on Bun: when an unhandled rejection is the last thing a process does, with nothing else
pending, Bun ends the process before anything can be sent. The record is still on stdout. An app
with a server, a connection or a timer running isn't affected.

## When PostHog can't be reached

PostHog being slow, down or over quota never blocks, throws or delays the app.

- At most 1,000 records are queued, and the oldest are dropped past that.
- Records are sent every 5 seconds or every 100 records, in requests under 2 MiB.
- Failed requests are retried with exponential backoff capped at one minute. Network errors, HTTP
  429 and 5xx are retried; other 4xx responses drop that batch.
- Sending writes one `warn` line to stdout when it starts failing and one `info` line when it
  recovers, never one per record. Those two lines obey `LOG_LEVEL` and are never sent to PostHog.

## Flushing and shutdown

`flush()` and `shutdown()` return promises that never reject. `shutdown()` flushes both channels
with a time limit of about 5 seconds, and it is safe to call twice. After it, records still go to
stdout.
