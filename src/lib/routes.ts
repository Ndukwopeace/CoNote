/** Every route path in the app (REQUIREMENTS.md section 7). No other file hard-codes a path. */
export const ROUTES = {
  landing: '/',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  terms: '/terms',
  privacy: '/privacy',

  dashboard: '/dashboard',
  classes: '/classes',
  courses: '/courses',
  notes: '/notes',
  newNote: '/notes/new',
  askAi: '/ask-ai',
  notifications: '/notifications',
  settings: '/settings',
  profile: '/profile',
} as const

export const SETTINGS_TABS = ['profile', 'account', 'notifications', 'privacy', 'help'] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

export function isSettingsTab(value: string | undefined): value is SettingsTab {
  return SETTINGS_TABS.some((tab) => tab === value)
}

export const routeTo = {
  course: (courseId: string) => `/courses/${encodeURIComponent(courseId)}`,
  class: (courseId: string, classId: string) =>
    `/courses/${encodeURIComponent(courseId)}/classes/${encodeURIComponent(classId)}`,
  summary: (courseId: string, classId: string) =>
    `/courses/${encodeURIComponent(courseId)}/classes/${encodeURIComponent(classId)}/summary`,
  note: (noteId: string) => `/notes/${encodeURIComponent(noteId)}`,
  editNote: (noteId: string) => `/notes/${encodeURIComponent(noteId)}/edit`,
  settings: (tab: SettingsTab) => `/settings/${tab}`,
  login: (redirect?: string) =>
    redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login',
}
