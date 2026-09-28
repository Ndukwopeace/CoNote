import { z } from 'zod'

import { AppError } from '@/lib/errors'
import { storageKey } from '@/lib/storage'
import type { Session } from '@/types/auth'

import type { AuthService } from '../types'

import { simulateLatency } from './latency'

/** The signed-in identity. Kept in sessionStorage only, so it never outlives the browser session. */
const SESSION_KEY = storageKey('session')
/**
 * "Remember me" marker in localStorage. Deliberately holds no email or name
 * (ENGINEERING_STANDARDS.md 6.4); a remembered visit restores the demo student.
 */
const REMEMBER_KEY = storageKey('remember')
const MIN_PASSWORD_LENGTH = 8

const DEMO_STUDENT = {
  id: 'student-victory',
  fullName: 'Victory Okafor',
  email: 'victory@conote.demo',
} as const

const sessionSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    role: z.enum(['student', 'teacher', 'admin']),
    fullName: z.string().min(1),
    email: z.email(),
    avatarUrl: z.string().optional(),
  }),
})

const emailSchema = z.email()

interface MockAuthOptions {
  localStore: Storage
  sessionStore: Storage
  latencyMs: number
}

function readSession(store: Storage): Session | null {
  const raw = store.getItem(SESSION_KEY)
  if (raw === null) return null
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const { avatarUrl, ...user } = parsed.data.user
    return { user: avatarUrl === undefined ? user : { ...user, avatarUrl } }
  } catch {
    return null
  }
}

function assertEmail(email: string) {
  if (!emailSchema.safeParse(email).success) {
    throw new AppError('validation', 'Enter a valid email address.')
  }
}

/**
 * Demo authentication (REQUIREMENTS.md FR-AUTH-7). Any valid email and non-empty password
 * signs in as the demo student. The identity lives in sessionStorage; "Remember me" adds an
 * opaque marker to localStorage so the demo student is restored in a later browser session.
 */
export function createMockAuthService({
  localStore,
  sessionStore,
  latencyMs,
}: MockAuthOptions): AuthService {
  const listeners = new Set<(session: Session | null) => void>()

  function emit(session: Session | null) {
    for (const listener of listeners) listener(session)
  }

  function store(session: Session, remember: boolean) {
    sessionStore.setItem(SESSION_KEY, JSON.stringify(session))
    if (remember) localStore.setItem(REMEMBER_KEY, '1')
    else localStore.removeItem(REMEMBER_KEY)
    emit(session)
    return session
  }

  function demoSession(email: string, fullName: string = DEMO_STUDENT.fullName): Session {
    return { user: { id: DEMO_STUDENT.id, role: 'student', fullName, email } }
  }

  return {
    async getSession() {
      await simulateLatency(latencyMs)
      const current = readSession(sessionStore)
      if (current) return current
      return localStore.getItem(REMEMBER_KEY) === null ? null : demoSession(DEMO_STUDENT.email)
    },

    async signIn({ email, password, remember }) {
      await simulateLatency(latencyMs)
      assertEmail(email)
      if (password.length === 0) throw new AppError('validation', 'Enter your password.')
      return store(demoSession(email), remember)
    },

    async signUp({ fullName, email, password }) {
      await simulateLatency(latencyMs)
      assertEmail(email)
      if (fullName.trim().length === 0) throw new AppError('validation', 'Enter your full name.')
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new AppError('validation', 'Use at least 8 characters for your password.')
      }
      return store(demoSession(email, fullName.trim()), true)
    },

    async signInWithProvider() {
      await simulateLatency(latencyMs)
      return store(demoSession(DEMO_STUDENT.email), true)
    },

    async signOut() {
      await simulateLatency(latencyMs)
      localStore.removeItem(REMEMBER_KEY)
      sessionStore.removeItem(SESSION_KEY)
      emit(null)
    },

    async requestPasswordReset(email) {
      await simulateLatency(latencyMs)
      assertEmail(email)
    },

    async updatePassword(newPassword) {
      await simulateLatency(latencyMs)
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new AppError('validation', 'Use at least 8 characters for your password.')
      }
    },

    onAuthChange(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
