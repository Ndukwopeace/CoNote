/**
 * Draws the app icons (REQUIREMENTS.md FR-PWA-1) from the CoNote logo mark, using the Chromium
 * that Playwright already installs, so no image library is needed. The PNGs are committed; run
 * this again only when the logo changes:
 *
 *   node scripts/generate-icons.mjs
 *
 * In the cloud environment, set PW_CHROMIUM_PATH as for the browser tests.
 */

// Headless Chromium, from the browser-test tooling.
import { chromium } from '@playwright/test'

// The mark's shapes on a 32-unit grid, the same as public/favicon.svg and the Logo component.
const GLYPH =
  // The open "C" stroke.
  '<path d="M20.5 11.2a6.5 6.5 0 1 0 0 9.6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
  // The dot inside the C.
  '<circle cx="22" cy="16" r="2" fill="#EEF2FF"/>'

/** The standard icon: the rounded brand square, exactly like the favicon. */
const ROUNDED = `<rect width="32" height="32" rx="8" fill="#4F46E5"/>${GLYPH}`

/**
 * Full-bleed icon for Android's maskable shapes and for iOS, which both apply their own corner
 * shapes. The square fills the image and the mark shrinks to 80% around the centre, so it stays
 * inside the safe zone whatever shape the system cuts.
 */
const FULL_BLEED = `<rect width="32" height="32" fill="#4F46E5"/><g transform="translate(16 16) scale(0.8) translate(-16 -16)">${GLYPH}</g>`

/** Every file to write: name, pixel size and artwork. */
const ICONS = [
  // Browsers and the install dialog.
  { file: 'icon-192.png', size: 192, art: ROUNDED },
  { file: 'icon-512.png', size: 512, art: ROUNDED },
  // Android home screens.
  { file: 'icon-maskable-512.png', size: 512, art: FULL_BLEED },
  // iPhone and iPad home screens.
  { file: 'apple-touch-icon-180.png', size: 180, art: FULL_BLEED },
]

// Use the environment's Chromium when given, otherwise Playwright's own.
const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
)
// A page with a transparent background, so rounded corners stay transparent.
const page = await browser.newPage()

// Draw and save each icon.
for (const { file, size, art } of ICONS) {
  // The page is exactly the icon's size.
  await page.setViewportSize({ width: size, height: size })
  // One SVG filling the page, with no margins.
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">${art}</svg></body></html>`,
  )
  // Save it, keeping transparency.
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: true })
  // Report progress.
  process.stdout.write(`wrote public/icons/${file}\n`)
}

// Done.
await browser.close()
