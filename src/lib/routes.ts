/**
 * Every route path in the app (REQUIREMENTS.md section 7). No other file hard-codes a path, so a
 * rename happens here once and every link follows.
 */

/** Every fixed route path in the app. */
export const ROUTES = {
  // Public landing page.
  landing: '/',
  // Sign in.
  login: '/login',
  // Create an account.
  signup: '/signup',
  // Ask for a password reset email.
  forgotPassword: '/forgot-password',
  // Set a new password from the email link.
  resetPassword: '/reset-password',
  // Terms of Service.
  terms: '/terms',
  // Privacy Policy.
  privacy: '/privacy',

  // Student home after sign-in.
  dashboard: '/dashboard',
  // Every class across courses.
  classes: '/classes',
  // Enrolled courses.
  courses: '/courses',
  // All of the student's notes.
  notes: '/notes',
  // Write a new note.
  newNote: '/notes/new',
  // Ask CoNote AI.
  askAi: '/ask-ai',
  // Notifications list.
  notifications: '/notifications',
  // Settings (defaults to the profile tab).
  settings: '/settings',
  // Old-style profile address; redirects to the profile tab of settings.
  profile: '/profile',
  // `as const` keeps the exact strings as types, so typos are caught at compile time.
} as const

/**
 * Section anchors on the landing page (FR-LND-1). The header links to `/#<id>`, so the links
 * also work from the Terms and Privacy pages, which share the header.
 */
export const LANDING_SECTIONS = {
  // The four feature cards.
  features: 'features',
  // The six steps.
  howItWorks: 'how-it-works',
  // Privacy and teacher approval.
  about: 'about',
  // Exact strings as types.
} as const

/** The Settings tabs, in display order. */
export const SETTINGS_TABS = ['profile', 'account', 'notifications', 'privacy', 'help'] as const
/** One of the tab names above, as a type. */
export type SettingsTab = (typeof SETTINGS_TABS)[number]

/**
 * True when a URL segment is a real settings tab.
 * SECURITY: only known tab names are accepted, so a crafted address cannot select a tab that
 * does not exist; unknown values are redirected to the profile tab.
 */
export function isSettingsTab(value: string | undefined): value is SettingsTab {
  // Compare against every known tab.
  return SETTINGS_TABS.some((tab) => tab === value)
}

/**
 * Builders for routes that contain IDs.
 * SECURITY: every ID is percent-encoded, so an ID containing "/", "?" or "#" cannot change the
 * shape of the path or add query parameters (path injection).
 */
export const routeTo = {
  // One course.
  course: (courseId: string) => `/courses/${encodeURIComponent(courseId)}`,
  // One class inside a course.
  class: (courseId: string, classId: string) =>
    `/courses/${encodeURIComponent(courseId)}/classes/${encodeURIComponent(classId)}`,
  // The summary of one class.
  summary: (courseId: string, classId: string) =>
    `/courses/${encodeURIComponent(courseId)}/classes/${encodeURIComponent(classId)}/summary`,
  // Read one note.
  note: (noteId: string) => `/notes/${encodeURIComponent(noteId)}`,
  // Edit one note.
  editNote: (noteId: string) => `/notes/${encodeURIComponent(noteId)}/edit`,
  // A settings tab; the type only allows real tab names.
  settings: (tab: SettingsTab) => `/settings/${tab}`,
  // Sign in, optionally remembering where to go afterwards (checked later by isSafeRedirect).
  login: (redirect?: string) =>
    redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login',
}
