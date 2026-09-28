/**
 * Vite configuration: how the app is served in development, built for production and previewed.
 */

// Reads vercel.json from disk.
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
 * The preview server (used by the end-to-end tests) sends the same security headers as
 * Vercel, so a Content-Security-Policy that breaks the app fails CI instead of production.
 * HSTS is skipped because preview runs over plain HTTP.
 */
function productionHeaders(): Record<string, string> {
  // Load vercel.json, the single source of truth for the headers.
  const config = JSON.parse(readFileSync('./vercel.json', 'utf8')) as VercelConfig
  // The headers applied to every path.
  const entries = config.headers?.find((rule) => rule.source === '/(.*)')?.headers ?? []
  // Convert to { name: value }, without HSTS (it would pin localhost to https).
  return Object.fromEntries(
    entries
      .filter((header) => header.key !== 'Strict-Transport-Security')
      .map((header) => [header.key, header.value]),
  )
}

export default defineConfig({
  // React first, then Tailwind.
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/lib/utils" means "src/lib/utils" everywhere, instead of long "../../" paths.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  preview: {
    // SECURITY: `npm run preview` sends the production security headers, so the browser tests
    // run under the exact policy users get.
    headers: productionHeaders(),
  },
})
