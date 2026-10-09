/**
 * Tracks the session and offers sign-in and sign-out to the portal: the shared provider
 * (packages/portal), given the portal's auth service and storage prefix.
 */

// Children type.
import type { ReactNode } from 'react'

// The shared provider.
import { AuthProvider as PortalAuthProvider } from '@conote/portal'

// The portal's storage prefix.
import { TEACHER_STORAGE_PREFIX } from '@/lib/storage'
// The services.
import { useServices } from '@/services/useServices'

/** Provides the sign-in state to the portal. */
export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  // The auth service.
  const { auth } = useServices()
  return (
    <PortalAuthProvider auth={auth} storagePrefix={TEACHER_STORAGE_PREFIX}>
      {children}
    </PortalAuthProvider>
  )
}
