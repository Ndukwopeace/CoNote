/**
 * @conote/portal: what the staff portals (admin console, teacher portal) share (D77): sign-in
 * state, the role guards, the demo auth service, the frame around every page, and the error
 * screens. The sign-in and recovery pages have their own entry points, so apps can lazy-load them.
 */

// Sign-in state and its types.
export { AuthContext } from './auth/AuthContext'
export type { AuthContextValue, AuthState } from './auth/AuthContext'
export { AuthProvider } from './auth/AuthProvider'
export { useAuth } from './auth/useAuth'
export { useAuthRequest } from './auth/useAuthRequest'
export type {
  AuthService,
  PasswordResetRequest,
  Session,
  SessionUser,
  SignInInput,
} from './auth/types'
// The role guards.
export { RedirectIfSignedIn, RequireRole, WrongRoleNotice } from './auth/guards'
// The shared sign-in and password rules.
export {
  STAFF_MIN_PASSWORD_LENGTH,
  forgotPasswordSchema,
  newStaffPasswordSchema,
  resetPasswordSchema,
  signInSchema,
} from './auth/authSchemas'
// The demo auth service.
export { createDemoAuthService, readStoredSession } from './auth/mockAuthService'
export type { DemoAuthConfig, MockAuthOptions } from './auth/mockAuthService'
export { simulateLatency } from './auth/latency'
// The frame around every page.
export { PortalFrame } from './frame/PortalFrame'
export type { NavItem, PortalConfig } from './frame/navItems'
// Error screens and wording.
export { ErrorState } from './components/ErrorState'
export { NotFoundPage } from './components/NotFoundPage'
export { RouteErrorBoundary } from './components/RouteErrorBoundary'
export { createErrorMessage, errorMessage } from './lib/errorMessages'
// The query cache.
export { createQueryClient } from './lib/queryClient'
