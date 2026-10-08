/**
 * The admin app's service interfaces: everything the UI may ask of the backend. Pages reach them
 * only through useServices(), so the demo data and Supabase are interchangeable (D66).
 */

// Session shapes.
import type { PasswordResetRequest, Session, SignInInput } from '@/types/auth'
// Dashboard shapes.
import type {
  ActivityPoint,
  ActivityRange,
  ActivitySeriesKey,
  HealthReport,
  PlatformAlert,
  PlatformOverview,
} from '@/types/dashboard'

/** Signing in and out, and the current session. */
export interface AuthService {
  /** The stored session, or null when signed out. */
  getSession(): Promise<Session | null>
  /** Signs in; rejects with a validation AppError for wrong details, never saying which was wrong. */
  signIn(input: SignInInput): Promise<Session>
  /** Signs out and forgets the session. */
  signOut(): Promise<void>
  /**
   * Asks for a reset link for `email`. Resolves the same way whether or not an account exists;
   * rejects only for a malformed email.
   */
  requestPasswordReset(email: string): Promise<PasswordResetRequest>
  /** Whether `code` is the newest, unused reset code. */
  checkResetLink(code: string | null): Promise<boolean>
  /** Sets a new password with `code`, checking both again; the code then stops working. */
  resetPassword(code: string, newPassword: string): Promise<void>
  /** Calls `listener` whenever the session changes. Returns a function that stops listening. */
  onAuthChange(listener: (session: Session | null) => void): () => void
}

/** Platform figures. A9 adds the Analytics page's statistics. */
export interface AnalyticsService {
  /** The six counts on the dashboard's stat cards. */
  getOverview(): Promise<PlatformOverview>
  /** One count per day for the last `range` days, oldest first, ending today. */
  getActivitySeries(range: ActivityRange, series: ActivitySeriesKey): Promise<ActivityPoint[]>
}

/** Problems worth an administrator's attention, computed from the platform's records. */
export interface AlertService {
  /** One entry per kind of problem that currently has a non-zero count, most urgent first. */
  listAlerts(): Promise<PlatformAlert[]>
}

/** The platform's health check (the `health` Edge Function in the backend stage). */
export interface HealthService {
  /** The latest state of each part of the platform. */
  getHealth(): Promise<HealthReport>
}

/** Every service the admin app uses. Grows with each milestone. */
export interface Services {
  auth: AuthService
  analytics: AnalyticsService
  alerts: AlertService
  health: HealthService
}
