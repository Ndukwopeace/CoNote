/**
 * M2.5 browser tests (docs/MILESTONES.md): the installable app. Runs against the production
 * build, where the service worker registers, with the production security headers.
 */

// Playwright's assertions and test function.
import { expect, test } from '@playwright/test'

// Shared helpers.
import { primaryNav, signIn, watchCspViolations } from './helpers.ts'

// FR-PWA-1: what the browser needs to offer installation.
test('the app has an installable manifest with its icons', async ({ page, request }) => {
  // The page links the manifest.
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBe('/manifest.webmanifest')

  // The manifest has the required fields.
  const manifest = (await (await request.get('/manifest.webmanifest')).json()) as {
    name: string
    start_url: string
    display: string
    icons: { src: string; sizes: string; purpose?: string }[]
  }
  expect(manifest).toMatchObject({ name: 'CoNote', start_url: '/dashboard', display: 'standalone' })

  // Every icon it lists actually loads, including the maskable one.
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512'])
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src)
    expect(response.ok(), icon.src).toBe(true)
  }
  // iOS's home-screen icon too.
  expect((await request.get('/icons/apple-touch-icon-180.png')).ok()).toBe(true)
})

// M2.5 "done when": Chrome itself finds nothing stopping installation. This asks Chrome the same
// question Lighthouse's installability audit does, through the DevTools protocol.
test('Chrome reports the app as installable', async ({ page, context }) => {
  // Load the app and let the manifest and icons load.
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Ask Chrome for anything blocking installation.
  const devtools = await context.newCDPSession(page)
  const { installabilityErrors } = (await devtools.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: { errorId: string }[]
  }

  // Nothing about the app blocks it. Playwright runs every test in a private window, where
  // Chrome never installs anything ("in-incognito"); that says nothing about CoNote, so it is the
  // one error ignored. Any manifest, icon or service-worker problem would still fail here.
  expect(
    installabilityErrors
      .map((error) => error.errorId)
      .filter((errorId) => errorId !== 'in-incognito'),
  ).toEqual([])
})

// FR-PWA-2 to FR-PWA-4, and M2.5's "done when": a returning student can work offline.
test('a returning student can open the app and move between pages offline', async ({
  page,
  context,
  isMobile,
}) => {
  // SECURITY: the service worker and self-hosted font must work under the production CSP.
  const cspViolations = watchCspViolations(page)

  // First visit, online: sign in and let the service worker install and take control.
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.evaluate(async () => {
    // Wait until the service worker is active.
    await navigator.serviceWorker.ready
  })
  // A reload puts the page under the service worker's control.
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)

  // Lose the connection.
  await context.setOffline(true)

  // The offline banner appears (FR-PWA-4).
  await expect(
    page.getByText("You're offline. Some things may not load until you reconnect."),
  ).toBeVisible()

  // Pages whose code was never loaded still open: it comes from the precache (FR-PWA-2).
  await primaryNav(page, isMobile).getByRole('link', { name: 'Notes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible()
  await primaryNav(page, isMobile).getByRole('link', { name: 'Courses' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'My Courses' })).toBeVisible()

  // Reopening an address offline is served from the cached app shell (FR-PWA-3).
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'My Courses' })).toBeVisible()

  // Reconnect: the banner goes away.
  await context.setOffline(false)
  await expect(page.getByText("You're offline.", { exact: false })).toBeHidden()

  // SECURITY: nothing in the journey was blocked by the security policy.
  expect(cspViolations).toEqual([])
})

// D23: the font is served by CoNote, so nothing is requested from Google.
test('the font loads from CoNote itself', async ({ page }) => {
  // Record every request's host.
  const hosts = new Set<string>()
  page.on('request', (request) => hosts.add(new URL(request.url()).host))

  // Load a page that uses every weight, and wait until its text has been drawn.
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  // The variable font is in use...
  expect(
    await page.evaluate(() => document.fonts.check('700 16px "Plus Jakarta Sans Variable"')),
  ).toBe(true)
  // ...and no font server was contacted.
  expect([...hosts].filter((host) => host.includes('google'))).toEqual([])
})
