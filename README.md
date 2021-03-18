# @4lch4/logger

This module is a small utility module for logging to stdout and, if desired, to also log to files.

## Installation

The module is published to the NPM registry so you're able to install it as you would any other module:

```shell
# Using NPM
npm install --save @4lch4/logger

# Using Yarn
yarn add @4lch4/logger

# Using PNPM
pnpm install @4lch4/logger
```

## Usage

Using the logger is fairly straight forward. Import the Logger, create a new instance with some optional properties, then use that instance throughout your application:

  > **_NOTE: You can also create new instances throughout your app and it will log to the same files/locations._**

```typescript
import { Logger } from '@4lch4/logger'
const logger = new Logger({
  // optional properties
})

logger.info('Hello, world!')
logger.error('Uh oh, something broke...')
```

## Logging Levels

It has 5 "levels" of logging with a color for each, which are as follows (in no particular order):

- debug - Cyan
- error - Red
- info - Gray
- success - Green
- warn - Yellow

If you provide a logDir when instantiating the Logger class, each level will have a file. For example, debug would be `2021.03.17-debug.log` whereas error would be `2021.03.17-error.log`.

Each level has a function to be called for logging at that level. For example, if you want to write to the debug level, you'd do `logger.debug('Debug message')`.
