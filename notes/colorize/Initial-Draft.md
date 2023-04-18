# Initial Draft

This document is the first draft of the file that will describe how to style the output sent through `console.log`.

## Initial Sample

```javascript
console.log('[color code]', 'your text here')

// red
console.log('\x1b[31m%s\x1b[0m', 'I am red')

// green
console.log('\x1b[32m%s\x1b[0m', 'I am green')

// yellow
console.log('\x1b[33m%s\x1b[0m', 'I am yellow')

// blue
console.log('\x1b[34m%s\x1b[0m', 'I am blue')

// magenta
console.log('\x1b[35m%s\x1b[0m', 'I am magenta')

// cyan
console.log('\x1b[36m%s\x1b[0m', 'I am cyan')
```
