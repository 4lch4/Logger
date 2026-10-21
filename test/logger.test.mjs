import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const distUrl = pathToFileURL(fileURLToPath(new URL('../dist/index.js', import.meta.url))).href
const importStatement = `import { ConsoleTransport, logger } from ${JSON.stringify(distUrl)};`

/** Environment variables that would change the logger's configuration during a test. */
const MANAGED_VARIABLES = [
  'API_NAME',
  'APP_NAME',
  'AXIOM_DATASET',
  'AXIOM_ORG_ID',
  'AXIOM_TOKEN',
  'LOG_LEVEL',
  'LOG_SERVICE',
  'NODE_ENV',
]

/**
 * Runs the given code in a child process with the built logger imported, using a copy of the
 * current environment with all logger-related variables removed, plus the given overrides.
 *
 * @param {string} code The code to run after importing the logger.
 * @param {Record<string, string | undefined>} overrides Environment variables to set.
 * @returns {string} The trimmed stdout of the child process.
 */
function run(code, overrides = {}) {
  const env = { ...process.env }

  for (const name of MANAGED_VARIABLES) delete env[name]

  return execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `${importStatement}\n${code}`],
    {
      encoding: 'utf8',
      env: { ...env, ...overrides },
    }
  ).trim()
}

test('LOG_LEVEL wins over NODE_ENV', () => {
  assert.equal(run('console.log(logger.level)', { LOG_LEVEL: 'error' }), 'error')
  assert.equal(
    run('console.log(logger.level)', { LOG_LEVEL: 'debug', NODE_ENV: 'production' }),
    'debug'
  )
})

test('defaults to info in production', () => {
  assert.equal(run('console.log(logger.level)', { NODE_ENV: 'production' }), 'info')
})

test('defaults to debug outside production', () => {
  assert.equal(run('console.log(logger.level)'), 'debug')
})

test('exposes success as a logging method', () => {
  assert.equal(run('console.log(typeof logger.success)'), 'function')
})

test('includes the console transport', () => {
  assert.equal(run('console.log(logger.transports.includes(ConsoleTransport))'), 'true')
})
