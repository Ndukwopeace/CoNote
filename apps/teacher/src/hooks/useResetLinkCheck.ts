/**
 * Asks the service whether a reset link is still valid, when the reset page opens.
 */

// Server state.
import { useQuery } from '@tanstack/react-query'

// The services.
import { useServices } from '@/services/useServices'

/** Whether `code` is the newest unused reset code; "pending" while the check runs. */
export function useResetLinkCheck(code: string | null) {
  // The auth service.
  const { auth } = useServices()
  return useQuery({
    // One check per code.
    queryKey: ['auth', 'reset-link', code],
    queryFn: () => auth.checkResetLink(code),
    // Checked once when the page opens; the reset itself checks again (the service rule).
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  })
}
