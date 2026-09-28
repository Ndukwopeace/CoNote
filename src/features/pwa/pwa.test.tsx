/**
 * Tests for the installable-app features: the offline banner (FR-PWA-4), the update toast
 * (FR-PWA-5), the unsaved-changes flag it respects, and the install prompt (FR-PWA-6).
 */

// Rendering, queries, hook rendering and state flushing.
import { act, render, renderHook, screen } from '@testing-library/react'
// Simulated user input.
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The hourly limit on update checks.
import { UPDATE_CHECK_INTERVAL_MS } from '@/lib/pwa'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'

// The units under test.
import { createInstallPromptStore, useInstallOption } from './installPrompt'
import { OfflineBanner } from './OfflineBanner'
import { setHasUnsavedChanges } from './unsavedChanges'
import { UpdatePrompt } from './UpdatePrompt'

/** What the mocked service-worker hook was last called with, and what it returns. */
const sw = vi.hoisted(() => ({
  // The options the component passed (so a test can call onRegisteredSW).
  options: undefined as undefined | { onRegisteredSW?: (url: string, reg: unknown) => void },
  // Whether a new version is waiting.
  needRefresh: false,
  // Records the call to hide the toast.
  setNeedRefresh: vi.fn<(value: boolean) => void>(),
  // Records the call that activates the new version.
  updateServiceWorker: vi.fn<(reload?: boolean) => Promise<void>>(() => Promise.resolve()),
}))

// Replace the plugin's virtual module with a controllable fake.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: typeof sw.options) => {
    // Remember the options for the test.
    sw.options = options
    // Hand back the fake state and actions.
    return {
      needRefresh: [
        sw.needRefresh,
        (value: boolean) => {
          sw.setNeedRefresh(value)
        },
      ],
      offlineReady: [false, () => undefined],
      updateServiceWorker: (reload?: boolean) => sw.updateServiceWorker(reload),
    }
  },
}))

// Every test starts online, with no update waiting and no unsaved changes.
beforeEach(() => {
  sw.needRefresh = false
  sw.options = undefined
  // Forget calls from earlier tests.
  sw.setNeedRefresh.mockClear()
  sw.updateServiceWorker.mockClear()
  setHasUnsavedChanges(false)
})

// Undo navigator.onLine stubs.
afterEach(() => {
  vi.restoreAllMocks()
})

/** Makes the browser report `online` and tells the page, as a real network change would. */
function setOnline(online: boolean) {
  // navigator.onLine reads the stubbed value.
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
  // The matching window event.
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'))
  })
}

describe('OfflineBanner', () => {
  // Proves nothing shows while online.
  it('shows nothing while online', () => {
    render(<OfflineBanner />)
    expect(screen.queryByText(/You're offline/)).toBeNull()
  })

  // Proves the banner appears and disappears with the connection (FR-PWA-4).
  it('announces going offline and clears on reconnect', async () => {
    // Arrange.
    const { container } = render(<OfflineBanner />)

    // Act: lose the connection.
    setOnline(false)

    // Assert: the message, in a polite live region, accessible.
    expect(
      screen
        .getByText("You're offline. Some things may not load until you reconnect.")
        .closest('[aria-live="polite"]'),
    ).not.toBeNull()
    await expectNoAxeViolations(container)

    // Act: reconnect.
    setOnline(true)

    // Assert: gone.
    expect(screen.queryByText(/You're offline/)).toBeNull()
  })

  // Proves the live region exists before the message, so screen readers announce the change.
  it('keeps an empty live region in place while online', () => {
    const { container } = render(<OfflineBanner />)
    expect(container.querySelector('[aria-live="polite"]')).toBeEmptyDOMElement()
  })
})

describe('UpdatePrompt', () => {
  // Proves no toast shows without an update.
  it('shows nothing when no update is waiting', () => {
    render(<UpdatePrompt />)
    expect(screen.queryByText(/new version/)).toBeNull()
  })

  // Proves the toast and its Reload button (FR-PWA-5).
  it('offers a reload when a new version is waiting', async () => {
    // Arrange: an update is waiting.
    sw.needRefresh = true
    const user = userEvent.setup()
    const { container } = render(<UpdatePrompt />)

    // Assert: the message, accessible.
    expect(screen.getByText('A new version of CoNote is available')).toBeInTheDocument()
    await expectNoAxeViolations(container)

    // Act: reload.
    await user.click(screen.getByRole('button', { name: 'Reload' }))

    // Assert: the new version was activated with a reload.
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true)
  })

  // Proves "Later" hides the toast without reloading.
  it('can be dismissed until the next update', async () => {
    // Arrange.
    sw.needRefresh = true
    const user = userEvent.setup()
    render(<UpdatePrompt />)

    // Act.
    await user.click(screen.getByRole('button', { name: 'Later' }))

    // Assert.
    expect(sw.setNeedRefresh).toHaveBeenCalledWith(false)
  })

  // Proves the toast waits while a note has unsaved changes, then appears (FR-PWA-5).
  it('waits while there are unsaved changes', () => {
    // Arrange: an update is waiting, and a note is being edited.
    sw.needRefresh = true
    setHasUnsavedChanges(true)
    render(<UpdatePrompt />)

    // Assert: no toast yet.
    expect(screen.queryByText(/new version/)).toBeNull()

    // Act: the note is saved.
    act(() => {
      setHasUnsavedChanges(false)
    })

    // Assert: now it shows.
    expect(screen.getByText('A new version of CoNote is available')).toBeInTheDocument()
  })

  // Proves the app looks for updates on focus, at most once per interval (FR-PWA-5).
  it('checks for a new version on focus at most once per interval', () => {
    // Arrange: a fake registration and a controllable clock.
    const registration = { update: vi.fn(() => Promise.resolve()) }
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    render(<UpdatePrompt />)
    // The service worker registers (which itself counts as a check).
    act(() => {
      sw.options?.onRegisteredSW?.('/sw.js', registration)
    })

    // Act: focus a minute later.
    clock.mockReturnValue(1_000_000 + 60_000)
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    // Assert: too soon, no check.
    expect(registration.update).not.toHaveBeenCalled()

    // Act: focus a full interval after registering.
    clock.mockReturnValue(1_000_000 + UPDATE_CHECK_INTERVAL_MS)
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    // Assert: one check.
    expect(registration.update).toHaveBeenCalledTimes(1)
  })
})

/** A fake `beforeinstallprompt` event with a recordable prompt(). */
function installPromptEvent() {
  // A cancelable event, like the real one.
  const event = new Event('beforeinstallprompt', { cancelable: true })
  // The browser's install dialog, recorded instead of shown.
  const prompt = vi.fn(() => Promise.resolve())
  // Attach the two members the app uses.
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) })
  // Both, so tests can dispatch the event and check the prompt.
  return { event, prompt }
}

describe('UpdatePrompt on iPhone', () => {
  /** Sets what document.visibilityState reports, then fires the change, as iOS does. */
  function setVisibility(state: DocumentVisibilityState) {
    // The value the component reads.
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
    // The event iOS sends when a home-screen app is left or reopened.
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
  }

  // Proves returning to the app checks for a new version even without a focus event, which
  // iOS home-screen apps often don't send (D37).
  it('checks when the app becomes visible again', () => {
    // Arrange: registered a full interval ago.
    const registration = { update: vi.fn(() => Promise.resolve()) }
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    render(<UpdatePrompt />)
    act(() => {
      sw.options?.onRegisteredSW?.('/sw.js', registration)
    })
    clock.mockReturnValue(1_000_000 + UPDATE_CHECK_INTERVAL_MS)

    // Act: the student comes back to the app.
    setVisibility('visible')

    // Assert: one check.
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  // Proves leaving the app doesn't trigger a check; only coming back does.
  it('does not check when the app is hidden', () => {
    // Arrange: registered a full interval ago.
    const registration = { update: vi.fn(() => Promise.resolve()) }
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    render(<UpdatePrompt />)
    act(() => {
      sw.options?.onRegisteredSW?.('/sw.js', registration)
    })
    clock.mockReturnValue(1_000_000 + UPDATE_CHECK_INTERVAL_MS)

    // Act: the student leaves the app.
    setVisibility('hidden')

    // Assert: no check.
    expect(registration.update).not.toHaveBeenCalled()
  })
})

describe('useInstallOption', () => {
  // Proves the item stays hidden until the browser offers installation (FR-PWA-6).
  it('is hidden until the browser offers an install prompt', () => {
    // Arrange: a fresh store listening to this window.
    const store = createInstallPromptStore()
    store.start(window)
    const { result } = renderHook(() => useInstallOption(store))

    // Assert: nothing to offer yet.
    expect(result.current.option).toBe('hidden')

    // Act: the browser offers installation.
    const { event } = installPromptEvent()
    act(() => {
      window.dispatchEvent(event)
    })

    // Assert: the item appears, and the browser's own mini-bar was suppressed.
    expect(result.current.option).toBe('prompt')
    expect(event.defaultPrevented).toBe(true)
    store.stop()
  })

  // Proves choosing the item opens the browser's dialog, and the prompt is used only once.
  it('shows the browser prompt once when chosen', async () => {
    // Arrange: a prompt is available.
    const store = createInstallPromptStore()
    store.start(window)
    const { result } = renderHook(() => useInstallOption(store))
    const { event, prompt } = installPromptEvent()
    act(() => {
      window.dispatchEvent(event)
    })

    // Act: install.
    await act(() => result.current.install())

    // Assert: the dialog opened, and the spent prompt is gone (browsers allow one use).
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(result.current.option).toBe('hidden')
    store.stop()
  })

  // Proves the item disappears once the app is installed.
  it('hides the item after installation', () => {
    // Arrange: a prompt is available.
    const store = createInstallPromptStore()
    store.start(window)
    const { result } = renderHook(() => useInstallOption(store))
    act(() => {
      window.dispatchEvent(installPromptEvent().event)
    })

    // Act: the browser reports the app was installed.
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    // Assert.
    expect(result.current.option).toBe('hidden')
    store.stop()
  })

  // Proves iOS gets the instructions instead of a prompt.
  it('offers instructions on iOS', () => {
    // Arrange: an iPhone.
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
    )
    const store = createInstallPromptStore()

    // Act.
    const { result } = renderHook(() => useInstallOption(store))

    // Assert.
    expect(result.current.option).toBe('ios')
  })
})
