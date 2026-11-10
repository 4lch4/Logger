import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

/**
 * The URL of a built module, for `import()`. Tests run against `dist`, which is what gets
 * published, so `npm run build` has to run first (`npm test` does it).
 *
 * @param {string} file The module's file name inside `dist`, such as `otlp.js`.
 * @returns {string} A `file:` URL.
 */
export function distUrl(file = 'index.js') {
  return new URL(`../dist/${file}`, import.meta.url).href
}

/** Environment variables that change how a logger is configured. */
export const MANAGED_VARIABLES = [
  'LOG_LEVEL',
  'NODE_ENV',
  'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT',
  'OTEL_EXPORTER_OTLP_LOGS_HEADERS',
  'OTEL_RESOURCE_ATTRIBUTES',
  'OTEL_SERVICE_NAME',
  'POSTHOG_API_KEY',
  'POSTHOG_HOST',
  'VCS_REVISION',
]

/**
 * A copy of the current environment without the logger's variables, plus the given ones.
 *
 * @param {Record<string, string | undefined>} overrides Variables to set.
 * @returns {Record<string, string | undefined>} The environment.
 */
export function cleanEnv(overrides = {}) {
  const env = { ...process.env }

  for (const name of MANAGED_VARIABLES) delete env[name]

  return { ...env, ...overrides }
}

/**
 * @typedef {object} CollectedRequest
 * @property {string} method The request's method.
 * @property {string} url The request's path and query.
 * @property {import('node:http').IncomingHttpHeaders} headers The request's headers.
 * @property {Buffer} body The request's body as it arrived.
 * @property {string} text The request's body as text, unzipped when it was sent with gzip.
 * @property {any} json The body parsed as JSON, or `undefined` when it isn't JSON.
 */

/**
 * Starts a local HTTP server that stands in for PostHog. It records every request and answers
 * `200 {}` until told otherwise. Nothing in the tests may send to the real PostHog.
 *
 * @returns {Promise<{
 *   origin: string,
 *   requests: CollectedRequest[],
 *   respondWith: (response: number | ((request: CollectedRequest) => number | Promise<number>)) => void,
 *   close: () => Promise<void>,
 * }>} `origin` is the server's address, such as `http://127.0.0.1:41234`. `respondWith` sets the
 *   status of every later response, or a function that picks it for each request.
 */
export async function startCollector() {
  /** @type {CollectedRequest[]} */
  const requests = []
  /** @type {number | ((request: CollectedRequest) => number | Promise<number>)} */
  let response = 200

  const server = createServer((req, res) => {
    const chunks = []

    req.on('data', chunk => chunks.push(chunk))
    req.on('end', async () => {
      const body = Buffer.concat(chunks)
      let text = ''
      let json

      try {
        const gzipped = req.headers['content-encoding'] === 'gzip'

        text = (gzipped ? gunzipSync(body) : body).toString('utf8')
        json = JSON.parse(text)
      } catch {
        json = undefined
      }

      const request = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body,
        text,
        json,
      }

      requests.push(request)

      const status = typeof response === 'function' ? await response(request) : response

      res.writeHead(status, { 'content-type': 'application/json' })
      res.end('{}')
    })
  })

  await new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(undefined)))

  const address = /** @type {import('node:net').AddressInfo} */ (server.address())

  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    respondWith(next) {
      response = next
    },
    close() {
      server.closeAllConnections()

      return new Promise(resolve => server.close(() => resolve(undefined)))
    },
  }
}

/**
 * Waits until the given function returns something truthy.
 *
 * @template T
 * @param {() => T | Promise<T>} check Called every few milliseconds.
 * @param {number} timeoutMs How long to wait before failing.
 * @returns {Promise<T>} What `check` returned.
 */
export async function waitFor(check, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs

  for (;;) {
    const result = await check()

    if (result) return result
    if (Date.now() > deadline) throw new Error(`Timed out after ${timeoutMs} ms.`)

    await new Promise(resolve => setTimeout(resolve, 5))
  }
}

/**
 * Runs code in a new process on the runtime the tests are running on (Node or Bun), with the
 * built package imported as `lib`. stdout isn't a terminal there, so records are JSON lines.
 *
 * @param {string} code An ES module's source. `lib` is `import * as lib` of `dist/index.js`.
 * @param {object} [options]
 * @param {Record<string, string | undefined>} [options.env] Variables to set on top of a clean
 *   environment (see {@link cleanEnv}).
 * @param {number} [options.timeoutMs] Kills the process after this long.
 * @returns {Promise<{
 *   code: number | null,
 *   signal: string | null,
 *   stdout: string,
 *   stderr: string,
 *   lines: any[],
 * }>} `lines` is every stdout line that parses as JSON, in order.
 */
export async function runChild(code, { env = {}, timeoutMs = 15_000 } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'logger-test-'))
  const file = join(directory, 'child.mjs')

  await writeFile(file, `import * as lib from ${JSON.stringify(distUrl())}\n${code}\n`)

  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [file], {
        env: cleanEnv(env),
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)

      child.stdout.setEncoding('utf8').on('data', chunk => (stdout += chunk))
      child.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk))
      child.on('error', reject)
      child.on('close', (code, signal) => {
        clearTimeout(timer)

        const lines = []

        for (const line of stdout.split('\n')) {
          try {
            if (line.trim()) lines.push(JSON.parse(line))
          } catch {
            // Not a JSON line; it's still in `stdout`.
          }
        }

        resolve({ code, signal, stdout, stderr, lines })
      })
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
