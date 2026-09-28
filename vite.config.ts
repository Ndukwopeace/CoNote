import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

interface VercelConfig {
  headers?: { source: string; headers: { key: string; value: string }[] }[]
}

/**
 * The preview server (used by the end-to-end tests) sends the same security headers as
 * Vercel, so a Content-Security-Policy that breaks the app fails CI instead of production.
 * HSTS is skipped because preview runs over plain HTTP.
 */
function productionHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync('./vercel.json', 'utf8')) as VercelConfig
  const entries = config.headers?.find((rule) => rule.source === '/(.*)')?.headers ?? []
  return Object.fromEntries(
    entries
      .filter((header) => header.key !== 'Strict-Transport-Security')
      .map((header) => [header.key, header.value]),
  )
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  preview: {
    headers: productionHeaders(),
  },
})
