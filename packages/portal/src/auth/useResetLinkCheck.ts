/**
 * Asks the service whether a reset link is still valid, when the reset page opens.
 */

// Server state.
import { useQuery } from '@tanstack/react-query'

// The auth state, which offers the check.
import { useAuth } from './useAuth'

/** Whether `code` is the newest unused reset code; "pending" while the check runs. */
export function useResetLinkCheck(code: string | null) {
  // The check, through the portal's auth service.
  const { checkResetLink } = useAuth()
  return useQuery({
    // One check per code.
    queryKey: ['auth', 'reset-link', code],
    queryFn: () => checkResetLink(code),
    // Checked once when the page opens; the reset itself checks again (the service rule).
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  })
}
