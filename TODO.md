`# TODO

This file is fairly self explanatory, no? It's where I'll store things that need to be done for this project.

- [ ] Add support for transports.
  - [ ] Console Transport
  - [ ] File Transport
  - [ ] Mezmo/LogDNA Transport
- [ ] Add support for custom transports.
  - [ ] Allow users of the library to define their own transport class that can be passed in to the Logger.
- [ ] Finish Mezmo/LogDNA support.
- [ ] Add some tests god dammit.
  - [ ] I _was_ using Mocha/Chai to test the library but that has since stopped working and I couldn't fix it. I need to get _something_ working though.
  - [ ] I want to give Jest a try again.
- [ ] Add support for _every_ method, and constructor signatures, that console has available as of [Node v18 (LTS)][0].
  - [ ] Constructors
    - [ ] `new Console(stdout[, stderr][, ignoreErrors])`
    - [ ] `new Console(options)`
  - [ ] Methods
    - [ ] `console.assert`
    - [ ] `console.clear`
    - [ ] `console.count`
    - [ ] `console.countReset`
    - [ ] `console.debug`
    - [ ] `console.dir`
    - [ ] `console.dirxml`
    - [ ] `console.error`
    - [ ] `console.group`
    - [ ] `console.groupCollapsed`
    - [ ] `console.groupEnd`
    - [ ] `console.info`
    - [ ] `console.log`
    - [ ] `console.table`
    - [ ] `console.time`
    - [ ] `console.timeEnd`
    - [ ] `console.timeLog`
    - [ ] `console.trace`
    - [ ] `console.warn`

[0]: https://nodejs.org/docs/latest-v18.x/api/console.html
