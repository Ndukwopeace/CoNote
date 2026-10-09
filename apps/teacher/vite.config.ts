/**
 * Vite configuration for the teacher app: how it is served in development, built for production
 * and previewed. Unlike the student app, it is a plain web app: no installable PWA and no launch
 * splash (D66, D74).
 */

// Reads vercel.json and package.json from disk.
import { readFileSync } from 'node:fs'
// Turns "./src" into an absolute path for the "@" alias.
import { fileURLToPath, URL } from 'node:url'

// Tailwind CSS v4's Vite plugin.
import tailwindcss from '@tailwindcss/vite'
// React support: JSX and fast refresh.
import react from '@vitejs/plugin-react'
// Typed configuration helper.
import { defineConfig } from 'vite'

/** The part of vercel.json this file reads. */
interface VercelConfig {
  headers?: { source: string; headers: { key: string; value: string }[] }[]
}

/**
 * The preview server (used by the end-to-end tests) sends the same security headers as Vercel,
 * so a Content-Security-Policy that breaks the app fails CI instead of production. HSTS is
 * skipped because preview runs over plain HTTP.
 */
function productionHeaders(): Record<string, string> {
  // This app's own vercel.json: its Vercel project uses apps/teacher as the Root Directory (D74).
  const config = JSON.parse(
    readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'),
  ) as VercelConfig
  // The headers applied to every path.
  const entries = config.headers?.find((rule) => rule.source === '/(.*)')?.headers ?? []
  // Convert to { name: value }, without HSTS (it would pin localhost to https).
  return Object.fromEntries(
    entries
      .filter((header) => header.key !== 'Strict-Transport-Security')
      .map((header) => [header.key, header.value]),
  )
}

/** The teacher app's version from its package.json, for Settings and error reports later. */
const APP_VERSION = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version

export default defineConfig({
  // Build-time constants: replaced in the code as plain text.
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  // React first, then Tailwind.
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/lib/routes" means "src/lib/routes", instead of long "../../" paths.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Its own port, so the student and teacher dev servers can run side by side.
    port: 5175,
  },
  build: {
    // SECURITY: never turn font files into inline data: URLs, however small. The CSP allows fonts
    // from CoNote's own address only (font-src 'self'), which blocks data: fonts.
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
  },
  preview: {
    // SECURITY: `npm run preview` sends the production security headers, so the browser tests
    // run under the exact policy teachers get.
    headers: productionHeaders(),
  },
})
