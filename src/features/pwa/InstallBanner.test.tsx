/**
 * Tests for the "Get the app" strip at the top of the public pages (FR-PWA-6, decision D34).
 */

// Rendering and queries.
import { render, screen } from '@testing-library/react'
// Simulated user input.
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

// The install option type.
import type { InstallOption } from '@/lib/pwa'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'

// The component under test.
import { InstallBanner } from './InstallBanner'

/** What the mocked install hook returns; each test sets the option. */
const install = vi.hoisted((): { option: InstallOption; install: Mock<() => Promise<void>> } => ({
  // What the browser supports.
  option: 'hidden',
  // Records the browser-prompt action.
  install: vi.fn(() => Promise.resolve()),
}))

// Replace the install hook, so each test can pick what the browser supports.
vi.mock('./installPrompt', () => ({ useInstallOption: () => install }))

// Every test starts with nothing to offer and no recorded calls.
beforeEach(() => {
  install.option = 'hidden'
  install.install.mockClear()
})

describe('InstallBanner', () => {
  // Proves the strip stays away where installing isn't possible, or CoNote is already installed.
  it('shows nothing when the app cannot be installed', () => {
    // Act.
    const { container } = render(<InstallBanner />)

    // Assert.
    expect(container).toBeEmptyDOMElement()
  })

  // Proves the button opens the browser's own install dialog.
  it('installs through the browser prompt where one is offered', async () => {
    // Arrange.
    install.option = 'prompt'
    const user = userEvent.setup()
    const { container } = render(<InstallBanner />)

    // Assert: the offer, accessible.
    expect(screen.getByText(/Get the CoNote app/)).toBeInTheDocument()
    await expectNoAxeViolations(container)

    // Act.
    await user.click(screen.getByRole('button', { name: 'Install app' }))

    // Assert.
    expect(install.install).toHaveBeenCalledTimes(1)
  })

  // Proves iOS gets the Add to Home Screen steps, since it has no install prompt.
  it('shows the Add to Home Screen steps on iOS', async () => {
    // Arrange.
    install.option = 'ios'
    const user = userEvent.setup()
    render(<InstallBanner />)

    // Act.
    await user.click(screen.getByRole('button', { name: 'Install app' }))

    // Assert: the steps open, and no browser prompt was attempted.
    expect(await screen.findByRole('dialog', { name: 'Install CoNote' })).toBeInTheDocument()
    expect(install.install).not.toHaveBeenCalled()
  })

  // Proves the strip can be closed, and stays closed on the next visit.
  it('can be dismissed and stays dismissed', async () => {
    // Arrange.
    install.option = 'prompt'
    const user = userEvent.setup()
    const { unmount } = render(<InstallBanner />)

    // Act: close it.
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    // Assert: gone now...
    expect(screen.queryByText(/Get the CoNote app/)).toBeNull()
    // ...and after the page is opened again.
    unmount()
    render(<InstallBanner />)
    expect(screen.queryByText(/Get the CoNote app/)).toBeNull()
  })

  // Proves blocked storage (private mode, strict settings) doesn't break the page.
  it('still works when browser storage is blocked', async () => {
    // Arrange: every storage call throws, as some private modes do.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    install.option = 'prompt'
    const user = userEvent.setup()
    render(<InstallBanner />)

    // Act: the strip shows, and closing it still works for this page view.
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    // Assert.
    expect(screen.queryByText(/Get the CoNote app/)).toBeNull()
  })
})
