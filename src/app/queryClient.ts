/**
 * Builds the TanStack Query client: the cache and refresh rules for all server data.
 */

// The cache that stores fetched data.
import { QueryClient } from '@tanstack/react-query'

// How long fetched data counts as fresh, in milliseconds.
const THIRTY_SECONDS = 30_000

/** TanStack Query defaults (ENGINEERING_STANDARDS.md section 8). */
export function createQueryClient() {
  // One client for the whole app.
  return new QueryClient({
    defaultOptions: {
      // Fresh for 30 s (fewer repeat requests); refresh when the student returns to the tab;
      // retry a failed request once before showing an error.
      queries: { staleTime: THIRTY_SECONDS, refetchOnWindowFocus: true, retry: 1 },
    },
  })
}
