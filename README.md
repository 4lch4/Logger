# @4lch4/logger

This module is a small utility module for logging to stdout and, if desired, to also log to files.

## Usage

Using the logger is fairly straight forward. Once you've installed it you can import it and instantiate a new class to be used throughout your application:

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

<ul>
  <li style="color: Cyan">debug - Cyan</li>
  <li style="color: red">error - Red</li>
  <li style="color: gray">info - Gray</li>
  <li style="color: green">success - Green</li>
  <li style="color: yellow">warn - Yellow</li>
</ul>

If you provide a logDir when instantiating the Logger class, each level will have a file. For example, debug would be `2021.03.17-debug.log` whereas error would be `2021.03.17-error.log`.

Each level has a function to be called for logging at that level. For example, if you want to write to the debug level, you'd do `logger.debug('Debug message')`.
