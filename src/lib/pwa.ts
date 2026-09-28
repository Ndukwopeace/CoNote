/**
 * Rules for the installable app (REQUIREMENTS.md FR-PWA-5 to FR-PWA-7): when to look for a new
 * version, when the update toast may show, which install option to offer, and which caches to
 * clear on sign-out. Pure functions, so the hooks that use them stay thin.
 */

/** How often, at most, the app asks the server for a new version (FR-PWA-5): one hour. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Every runtime cache that may hold student data is named with this prefix (FR-PWA-7).
 * M4 and M5 must use it when they add runtime caching, so sign-out removes their caches.
 */
export const RUNTIME_CACHE_PREFIX = 'conote-runtime-'

/**
 * True when enough time has passed since the last update check.
 * `lastCheckedAt` is null before the first check.
 */
export function shouldCheckForUpdate(lastCheckedAt: number | null, now: number): boolean {
  // Never checked: check now.
  if (lastCheckedAt === null) return true
  // A last check "in the future" means the clock moved back; check rather than wait for hours.
  if (lastCheckedAt > now) return true
  // Otherwise only once the interval has passed.
  return now - lastCheckedAt >= UPDATE_CHECK_INTERVAL_MS
}

/**
 * True when the "new version" toast may show: an update is waiting and no note has unsaved
 * changes. Reloading would otherwise throw away writing (FR-PWA-5).
 */
export function shouldShowUpdatePrompt({
  updateReady,
  hasUnsavedChanges,
}: Readonly<{ updateReady: boolean; hasUnsavedChanges: boolean }>): boolean {
  // Both conditions must hold.
  return updateReady && !hasUnsavedChanges
}

/** Which install option the avatar menu offers (FR-PWA-6). */
export type InstallOption =
  // The browser's own install prompt.
  | 'prompt'
  // Instructions for iOS: Share, then "Add to Home Screen".
  | 'ios'
  // Nothing: already installed, or the browser can't install web apps.
  | 'hidden'

/** Picks the install option from what the browser supports and whether the app is installed. */
export function installOption({
  isStandalone,
  canPrompt,
  isIos,
}: Readonly<{ isStandalone: boolean; canPrompt: boolean; isIos: boolean }>): InstallOption {
  // Running as the installed app: nothing to install.
  if (isStandalone) return 'hidden'
  // The browser has handed over an install prompt: use it.
  if (canPrompt) return 'prompt'
  // iOS never offers a prompt, but can add to the home screen by hand.
  if (isIos) return 'ios'
  // Anything else can't install; hide the item rather than offer something that fails.
  return 'hidden'
}

/**
 * True on iPhone, iPad and iPod. iPadOS Safari reports itself as a Mac, so a "Macintosh" with a
 * touch screen counts too.
 */
export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  // Phones and older iPads name themselves.
  if (/iPhone|iPad|iPod/.test(userAgent)) return true
  // Newer iPads: a Mac user agent, but Macs have no touch screen.
  return userAgent.includes('Macintosh') && maxTouchPoints > 1
}

/** The part of the browser's CacheStorage that clearing needs. */
interface CacheStore {
  // Every cache name.
  keys: () => Promise<string[]>
  // Deletes one cache by name.
  delete: (name: string) => Promise<boolean>
}

/**
 * Deletes every CoNote runtime cache (FR-PWA-7). The precached app shell holds no student data,
 * so it is kept and the app still opens offline for the next person.
 * SECURITY: blocks the next person on a shared computer from reading the previous student's
 * cached notes or summaries.
 */
export async function clearRuntimeCaches(caches: CacheStore | undefined): Promise<void> {
  // No Cache API (older browsers, some private modes): nothing was cached, so nothing to clear.
  if (!caches) return
  // Every cache name in this origin.
  const names = await caches.keys()
  // Delete the runtime ones, in parallel.
  await Promise.all(
    names
      .filter((name) => name.startsWith(RUNTIME_CACHE_PREFIX))
      .map((name) => caches.delete(name)),
  )
}
