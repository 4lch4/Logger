/**
 * This type represents the different built-in transports that can be used by the logger that
 * determine where logging data should be sent.
 *
 * - `file` - Data is sent to disk, using a collection of rules to determine what files should be named, and more.
 * - `console` - The simplest, data is sent straight to `stdout`.
 * - `mezmo` - Data is sent to a Mezmo/LogDNA tenant using an ingestion token.
 * - `all` - Data is sent to all of the transports that are configured.
 */
export type BuiltInTransports = 'file' | 'console' | 'mezmo' | 'all'
