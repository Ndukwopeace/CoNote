/**
 * The "Install app" option (FR-PWA-6). Chrome and Edge hand the page a `beforeinstallprompt`
 * event, often before any menu exists, so a store started in main.tsx catches it and keeps it
 * until the student chooses "Install app".
 */

// Subscribes a component to the store.
import { useSyncExternalStore } from 'react'

// The rule that turns browser facts into an option, and the iOS check.
import { installOption, isIosDevice, type InstallOption } from '@/lib/pwa'

/** The non-standard event Chromium browsers fire when the app can be installed. */
interface BeforeInstallPromptEvent extends Event {
  // Opens the browser's install dialog. Works once per event.
  prompt: () => Promise<void>
}

/** True when the page is running as the installed app rather than in a browser tab. */
function isStandalone() {
  // Chromium and Firefox report the display mode through a media query (missing in jsdom).
  const displayMode =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  // iOS Safari has its own flag instead.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  // Either means installed.
  return displayMode || iosStandalone
}

/** Creates a store that remembers the install prompt. One lives in the app; tests make their own. */
export function createInstallPromptStore() {
  // The saved event, until used or the app is installed.
  let deferred: BeforeInstallPromptEvent | null = null
  // Set once the browser reports the app was installed during this visit.
  let installed = false
  // Components waiting to hear about changes.
  const listeners = new Set<() => void>()
  // Removes the window listeners; null while not started.
  let detach: (() => void) | null = null

  /** Tells every listener something changed. */
  function notify() {
    for (const listener of listeners) listener()
  }

  /** Saves the browser's offer and stops its own mini install bar from appearing. */
  function onPrompt(event: Event) {
    // The app offers installation from its menu instead, at a moment the student chooses.
    event.preventDefault()
    // Keep it for later.
    deferred = event as BeforeInstallPromptEvent
    // The menu item can appear now.
    notify()
  }

  /** Forgets the offer once the app is installed. */
  function onInstalled() {
    // The prompt can't be used again.
    deferred = null
    // Hide the item for the rest of this visit.
    installed = true
    notify()
  }

  // Arrow functions rather than methods, so components can take them off the object (as
  // useSyncExternalStore does) without losing anything.
  return {
    /** Starts listening on `target`. Safe to call more than once. */
    start: (target: Window) => {
      // Already listening.
      if (detach) return
      // Catch the offer and the installation.
      target.addEventListener('beforeinstallprompt', onPrompt)
      target.addEventListener('appinstalled', onInstalled)
      // Remember how to stop.
      detach = () => {
        target.removeEventListener('beforeinstallprompt', onPrompt)
        target.removeEventListener('appinstalled', onInstalled)
        detach = null
      }
    },
    /** Stops listening (tests). */
    stop: () => {
      detach?.()
    },
    /** Adds a listener; returns the function that removes it. */
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** Which option the menu should show right now. */
    getOption: (): InstallOption => {
      return installOption({
        // Installed now, or earlier in this visit.
        isStandalone: installed || isStandalone(),
        // A saved offer exists.
        canPrompt: deferred !== null,
        // iPhone or iPad.
        isIos: isIosDevice(navigator.userAgent, navigator.maxTouchPoints),
      })
    },
    /** Opens the browser's install dialog, once. */
    install: async () => {
      // Take the saved offer; each one works only once.
      const event = deferred
      deferred = null
      // The item hides while the dialog is open and after.
      notify()
      // Show the dialog, if there was an offer.
      await event?.prompt()
    },
  }
}

/** The app's single store, started in main.tsx. */
export const installPromptStore = createInstallPromptStore()

/** The install option for the avatar menu, and the action for the "prompt" case. */
export function useInstallOption(store = installPromptStore) {
  // Re-renders when the offer arrives, is used, or the app is installed.
  const option = useSyncExternalStore(store.subscribe, store.getOption, store.getOption)
  // The option and the action.
  return { option, install: store.install }
}
