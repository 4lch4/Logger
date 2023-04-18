# @4lch4/logger

This repository is home to my (@4lch4) Logger library, which is a library for (obviously) logging data. It is built to be extremely simple to use out of the box but with the ability to be customized and further enhanced.

<!-- In more detail, I found the standard `console.log` to be plenty powerful, but there were things I wanted to do with it on a more frequent basis that required some extra finagling. Because of this, I created this library to simplify these things. For more information on what I mean, refer to

For example, one thing I found myself doing regularly was altering the color of the text being displayed with something like chalk. This enables me to have a log-level such as "success" and "fail", and for them to be colored green and red respectively, making log reading much easier from a terminal. -->

## Features

- Default exported logger that's simple to use but unusually powerful.
- Added log levels for successes and failures.
  - `logger.success` | `logger.fail`
- Output text is colorized using [chalk][0] (where possible) with default settings that can be modified as desired.
- Mezmo/LogDNA
  - By default the logger will send logs to the console _and_ (if an ingestion token is provided) also [Mezmo/LogDNA][1].
- Custom Transports
  - Send your log data to where you want. Console, files, cloud, whatever you want.

## Usage

The following is a simple example of how to use the pre-built logger (details on what this means later) that's exported:

```typescript
import { logger } from '@4lch4/logger'

logger.info('This is an info level message.')
logger.fail('This is a failure-level message.')
logger.success('This is a success-level message.')
```

### Mezmo/LogDNA Support

By default, the library will look for an environment variable with the ingestion token to send the data to [Mezmo][1]. The token is retrieved by checking the following environment variables (in order) for a value and as soon as one is found, the remaining variables are ignored:

1. `INGESTION_TOKEN`
2. `MEZMO_TOKEN`
3. `LOGDNA_TOKEN`
4. `MEZMO_INGESTION_TOKEN`
5. `LOGDNA_INGESTION_TOKEN`

If _none_ of the above variables are set then no data is sent to Mezmo/LogDNA.

### Custom Logger

As I mentioned above, the exported `logger` object is a pre-built logger to use out of the box but the `@4lch4/logger` library exports a `Logger` class that lets you build your own logger to use.

You can customize just about anything the logger can do, for example:

```typescript
import { Logger } from '@4lch4/logger'
```







[0]: https://github.com/chalk/chalk
[1]: https://www.mezmo.com/logdna
