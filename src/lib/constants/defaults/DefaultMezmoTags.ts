import OS from 'os'

/**
 * An array of strings to use as the default tags for the logger, should none be
 * provided by the user.
 */
export const DEFAULT_MEZMO_TAGS: string[] = [
  '@4lch4/logger',
  'nodejs',
  'typescript',
  `OSPlatform:${OS.platform()}`,
  `OSType:${OS.type()}`,
]
