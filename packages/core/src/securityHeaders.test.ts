/**
 * Guards the security headers of all three deployed apps. Each app is its own Vercel project with
 * its own vercel.json, so a header added to one and forgotten in another would go unnoticed
 * (a Wapiti scan found missing headers). This reads the real files, so the rule can't drift.
 */

/// <reference types="node" />
// Reads the JSON files.
import { readFileSync } from 'node:fs'
// Joins paths.
import { join } from 'node:path'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The repository root, three folders above this file (packages/core/src).
const ROOT = join(import.meta.dirname, '..', '..', '..')

// The vercel.json of each deployed app: the student app's sits at the root (D64).
const FILES = {
  student: 'vercel.json',
  admin: join('apps', 'admin', 'vercel.json'),
  teacher: join('apps', 'teacher', 'vercel.json'),
}

/** The headers sent for every path, as { name: value }. */
function headersOf(file: string): Record<string, string> {
  // The parsed file.
  const config = JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as {
    headers?: { source: string; headers: { key: string; value: string }[] }[]
  }
  // The rule that covers every route.
  const rule = config.headers?.find((entry) => entry.source === '/(.*)')
  // Name to value.
  return Object.fromEntries((rule?.headers ?? []).map((header) => [header.key, header.value]))
}

describe.each(Object.entries(FILES))('security headers of the %s app', (_name, file) => {
  // The headers sent on every route of this app.
  const headers = headersOf(file)

  // Proves the plain headers are present with their strict values.
  it('sends the fixed headers on every route', () => {
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()')
  })

  // Proves HTTPS is pinned for at least two years, on subdomains too.
  it('pins HTTPS for two years including subdomains', () => {
    const hsts = headers['Strict-Transport-Security'] ?? ''
    expect(hsts).toContain('max-age=63072000')
    expect(hsts).toContain('includeSubDomains')
  })

  // Proves the policy is enforced and keeps the protections that matter most.
  it('enforces a Content-Security-Policy with no script exceptions', () => {
    const csp = headers['Content-Security-Policy'] ?? ''
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    // Scripts may come from CoNote only: no inline scripts, no eval, no other site.
    const scripts = /(?:^|;\s*)script-src ([^;]*)/.exec(csp)?.[1] ?? ''
    expect(scripts).toBe("'self'")
    expect(csp).not.toContain('unsafe-eval')
  })

  // Proves the policy names no origin except CoNote itself and the Supabase project.
  it('allows no outside origin except Supabase', () => {
    const csp = headers['Content-Security-Policy'] ?? ''
    // Every host the policy mentions.
    const hosts = [...csp.matchAll(/(?:https?|wss?):\/\/[^\s;]+/g)].map((match) => match[0])
    expect(hosts.every((host) => host.endsWith('.supabase.co'))).toBe(true)
  })
})
