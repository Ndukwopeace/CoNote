/**
 * M2.5 browser tests (docs/MILESTONES.md): the installable app. Runs against the production
 * build, where the service worker registers, with the production security headers.
 */

// Playwright's assertions and test function.
import { expect, test } from '@playwright/test'

// Shared helpers.
import { expectNoAxeViolations, primaryNav, signIn, watchCspViolations } from './helpers.ts'

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

// D34: the "Get the CoNote app" strip on the public pages, where Chrome offers installation.
test('the landing page offers to install the app', async ({ page }) => {
  // Open the landing page and wait for it to render.
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // Chrome would fire this when CoNote is installable; tests run in a private window, where it
  // never does, so the test fires it, with a prompt() that records being called.
  await page.evaluate(() => {
    const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: () => {
        document.body.dataset.installPrompted = 'yes'
        return Promise.resolve()
      },
    })
    window.dispatchEvent(offer)
  })

  // The strip appears at the top, and passes axe, including colour contrast.
  const strip = page.getByRole('banner').getByText('Get the CoNote app.')
  await expect(strip).toBeVisible()
  await expectNoAxeViolations(page)

  // "Install app" opens the browser's dialog.
  await page.getByRole('banner').getByRole('button', { name: 'Install app' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-install-prompted', 'yes')
})

// D34 on iOS, which has no install prompt: the strip shows the Add to Home Screen steps.
test('the landing page shows the Add to Home Screen steps on iPhone', async ({ browser }) => {
  // A fresh window that identifies as iPhone Safari.
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  })
  const page = await context.newPage()

  // The strip is offered straight away.
  await page.goto('/')
  await page.getByRole('banner').getByRole('button', { name: 'Install app' }).click()

  // The steps open in a dialog, accessible.
  const dialog = page.getByRole('dialog', { name: 'Install CoNote' })
  await expect(dialog).toContainText('Add to Home Screen')
  await expectNoAxeViolations(page)

  // Closing the strip keeps it closed after a reload.
  await dialog.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('Get the CoNote app.')).toBeHidden()
  await context.close()
})

// D36: the installed app shows sign-in and the portal, never the public landing page.
test('the installed app skips the landing page', async ({ browser }) => {
  // A window that reports the installed-app display mode, as Chrome does after installing.
  const context = await browser.newContext()
  await context.addInitScript(() => {
    // Keep the browser's own matchMedia for every other query.
    const original = window.matchMedia.bind(window)
    // Answer "yes" to the standalone query only, on a real MediaQueryList.
    window.matchMedia = (query: string) => {
      const list = original(query)
      if (query === '(display-mode: standalone)') {
        Object.defineProperty(list, 'matches', { value: true })
      }
      return list
    }
  })
  const page = await context.newPage()

  // Opening "/" lands on sign in, not the landing page.
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible()

  // Signing in reaches Home as usual.
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)

  // Signing out ends on sign in, not the landing page.
  await page.getByRole('button', { name: /account menu/i }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await context.close()
})
