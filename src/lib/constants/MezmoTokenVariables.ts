/**
 * An array containing the possible names of the environment variable that contains the ingestion
 * token necessary to send data to [Mezmo/LogDNA][0].
 *
 * [0]: https://mezmo.com
 */
export const MEZMO_TOKEN_VARIABLES = [
  'MEZMO_TOKEN',
  'LOGDNA_TOKEN',
  'MEZMO_INGESTION_TOKEN',
  'LOGDNA_INGESTION_TOKEN',
  'INGESTION_TOKEN',
]
