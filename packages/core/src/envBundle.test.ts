/**
 * Guards against a secret reaching a browser bundle through the build-time environment.
 *
 * SECURITY: Vite replaces `import.meta.env.VITE_X` with that one value, but a bare `import.meta.env`
 * is replaced with an object holding EVERY `VITE_` variable present at build time. A key set for
 * a test (`VITE_SUPABASE_TEST_SERVICE_KEY`) or by mistake in a hosting dashboard would then be
 * printed into the public JavaScript. This reads the real app sources and fails on any bare use.
 */

/// <reference types="node" />
// Reads folders and files.
import { readdirSync, readFileSync, statSync } from 'node:fs'
// Joins and tidies paths.
import { join, relative } from 'node:path'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The repository root, three folders above this file (packages/core/src).
const ROOT = join(import.meta.dirname, '..', '..', '..')

/** Every file under `folder`, skipping installed packages and build output. */
function filesUnder(folder: string): string[] {
  // The entries of this folder.
  return readdirSync(folder).flatMap((name) => {
    // Never descend into installed packages or built files.
    if (name === 'node_modules' || name === 'dist') return []
    // The full path of this entry.
    const path = join(folder, name)
    // A folder is searched; a file is listed.
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

/** True for files that run in the browser: app and package sources that are not tests. */
function isShippedSource(path: string) {
  // Only TypeScript sources count.
  if (!/\.(ts|tsx)$/.test(path)) return false
  // Tests and the helpers only tests import run in Node, never in a browser bundle.
  if (/\.test\.(ts|tsx)$/.test(path) || path.endsWith('integrationSupport.ts')) return false
  // Test-only packages and test folders are never bundled.
  return !path.includes(join('packages', 'testing')) && !path.includes(join('src', 'test'))
}

describe('build-time environment', () => {
  // Proves no browser source reads `import.meta.env` as a whole object.
  it('reads each VITE_ variable by name, never the whole import.meta.env object', () => {
    // The apps and the shared packages.
    const sources = ['apps', 'packages'].flatMap((folder) => filesUnder(join(ROOT, folder)))
    // Lines that use `import.meta.env` without a `.NAME` right after it.
    const offenders = sources.filter(isShippedSource).flatMap((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, index }))
        // A comment may mention it; code may not. `import.meta.env.NAME` is the allowed form.
        .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .filter(({ line }) => /import\.meta\.env(?!\.[A-Z_]+)/.test(line))
        .map(({ index }) => `${relative(ROOT, path)}:${String(index + 1)}`),
    )

    expect(offenders).toEqual([])
  })
})
