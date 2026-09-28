/**
 * Builds the TanStack Query client: the cache and refresh rules for all server data.
 */

// The cache that stores fetched data, and the query cache that reports failures.
import { QueryCache, QueryClient } from '@tanstack/react-query'

// Which failures are tried again.
import { shouldRetryQuery } from '@/lib/queryRetry'
// Reports failures to developers.
import { reportError } from '@/lib/reportError'

// How long fetched data counts as fresh, in milliseconds.
const THIRTY_SECONDS = 30_000

/** TanStack Query defaults (ENGINEERING_STANDARDS.md section 8). */
export function createQueryClient() {
  // One client for the whole app.
  return new QueryClient({
    // Every failed read is reported once, here, so no page has to remember to do it.
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportError(error, { where: 'query', queryKey: query.queryKey })
      },
    }),
    defaultOptions: {
      // Fresh for 30 s (fewer repeat requests); refresh when the student returns to the tab;
      // retry a passing failure once, but show "not found" and similar answers straight away.
      queries: { staleTime: THIRTY_SECONDS, refetchOnWindowFocus: true, retry: shouldRetryQuery },
    },
  })
}
