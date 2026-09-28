/**
 * Tests for the "Install app" item in the account menu (FR-PWA-6).
 */

// Queries the rendered page.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

// The real route table, so the menu sits in the real portal shell.
import { routes } from '@/app/routes'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'
// The install option type.
import type { InstallOption } from '@/lib/pwa'

/** What the mocked install hook returns; each test sets the option. */
const install = vi.hoisted((): { option: InstallOption; install: Mock<() => Promise<void>> } => ({
  // Which item to show.
  option: 'hidden',
  // Records the browser-prompt action.
  install: vi.fn(() => Promise.resolve()),
}))

// Replace the install hook, so each test can pick what the browser supports.
vi.mock('@/features/pwa/installPrompt', () => ({ useInstallOption: () => install }))

// Every test starts with no install option and no recorded calls.
beforeEach(() => {
  install.option = 'hidden'
  install.install.mockClear()
})

/** Renders the dashboard signed in and opens the account menu. */
async function openAccountMenu() {
  // Signed in, on a portal page.
  const result = renderWithRouter({ routes, path: '/dashboard', session: makeSession() })
  // Open the avatar menu once the page has loaded.
  await result.user.click(await screen.findByRole('button', { name: /Account menu/ }))
  // Hand back the tools.
  return result
}

describe('UserMenu install item', () => {
  // Proves the item stays out of the way where installing isn't possible.
  it('is hidden when the browser cannot install the app', async () => {
    // Act.
    await openAccountMenu()

    // Assert.
    expect(screen.queryByRole('menuitem', { name: 'Install app' })).toBeNull()
  })

  // Proves the item opens the browser's own install dialog.
  it('opens the browser install prompt when one is available', async () => {
    // Arrange.
    install.option = 'prompt'
    const { user } = await openAccountMenu()

    // Act.
    await user.click(screen.getByRole('menuitem', { name: 'Install app' }))

    // Assert.
    expect(install.install).toHaveBeenCalledTimes(1)
  })

  // Proves iOS gets the Share → Add to Home Screen instructions instead.
  it('shows the Add to Home Screen steps on iOS', async () => {
    // Arrange.
    install.option = 'ios'
    const { user } = await openAccountMenu()

    // Act.
    await user.click(screen.getByRole('menuitem', { name: 'Install app' }))

    // Assert: the dialog, its steps, and no accessibility problems.
    const dialog = await screen.findByRole('dialog', { name: 'Install CoNote' })
    expect(dialog).toHaveTextContent('Share')
    expect(dialog).toHaveTextContent('Add to Home Screen')
    expect(install.install).not.toHaveBeenCalled()
    await expectNoAxeViolations(document.body)
  })
})
