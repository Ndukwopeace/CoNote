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
// Builds the service worker and web app manifest (M2.5, FR-PWA-1 to FR-PWA-3).
import { VitePWA } from 'vite-plugin-pwa'

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

/** The installable-app plugin: manifest, icons and the precaching service worker. */
const pwa = VitePWA({
  // A new version waits for the student's "Reload" instead of replacing the app silently
  // (FR-PWA-5).
  registerType: 'prompt',
  // The app registers the service worker itself (UpdatePrompt), so no extra script is injected.
  injectRegister: false,
  // Copied to the build and precached with the rest of the shell.
  includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
  // The web app manifest (FR-PWA-1).
  manifest: {
    // Names under the icon and in the install dialog.
    name: 'CoNote',
    short_name: 'CoNote',
    // Shown by the install dialog and app stores.
    description: 'Your notes. Collective understanding.',
    // A stable identity, so a change of start page is not treated as a different app.
    id: '/',
    // Every page belongs to the app.
    scope: '/',
    // Opens at the dashboard; a signed-out student is sent to sign in and then back.
    start_url: '/dashboard',
    // A window of its own, without the browser's address bar.
    display: 'standalone',
    // Title bar and splash colours, from the design tokens. The brand colour behind the icon on
    // Android's launch screen flows straight into the in-app splash (D61).
    theme_color: '#4F46E5',
    background_color: '#4F46E5',
    // Icons made from the logo mark by scripts/generate-icons.mjs.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      // Android crops maskable icons into its own shapes; this one keeps the mark in the safe zone.
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    // Precache the app shell: HTML, every script and style chunk, the font and the icons
    // (FR-PWA-2). The Latin font files only; the browser never needs the other alphabets here.
    globPatterns: ['**/*.{html,js,css,svg,png}', 'assets/*latin-wght-normal*.woff2'],
    // iPhone launch images are fetched by iOS when the app is added to the home screen, not by
    // the app, so they stay out of the offline download (about 10 files).
    globIgnores: ['splash/**'],
    // Any in-app address opened offline gets index.html, so client-side routes work (FR-PWA-3).
    navigateFallback: '/index.html',
    // Delete caches left by older versions of the service worker.
    cleanupOutdatedCaches: true,
  },
})

/** The app's version from package.json, shown under Settings → Help (FR-SET-5). */
const APP_VERSION = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version

export default defineConfig({
  // Build-time constants: replaced in the code as plain text, so nothing reads package.json at run time.
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  // React first, then Tailwind, then the installable-app plugin.
  plugins: [react(), tailwindcss(), pwa],
  resolve: {
    // "@/lib/utils" means "src/lib/utils" everywhere, instead of long "../../" paths.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // SECURITY: never turn font files into inline data: URLs, however small. The CSP allows fonts
    // from CoNote's own address only (font-src 'self'), which blocks data: fonts; allowing them
    // would also let injected CSS load any font it carries. Other small files may still be inlined.
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
  },
  preview: {
    // SECURITY: `npm run preview` sends the production security headers, so the browser tests
    // run under the exact policy users get.
    headers: productionHeaders(),
  },
})
