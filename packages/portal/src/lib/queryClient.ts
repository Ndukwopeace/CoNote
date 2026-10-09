/**
 * The TanStack Query cache for server data, with the staff portals' defaults.
 */

// Query cache classes.
import { QueryCache, QueryClient } from '@tanstack/react-query'

// Error reporting.
import { reportError } from '@conote/core/reportError'

/** How long fetched data counts as fresh before it is fetched again. */
const THIRTY_SECONDS = 30_000

/** A new query cache. */
export function createQueryClient() {
  return new QueryClient({
    // Every failed query is reported once, here, instead of in each page.
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportError(error, { where: 'query', queryKey: query.queryKey })
      },
    }),
    defaultOptions: {
      queries: {
        // Fresh for 30 seconds, then refetched when used again.
        staleTime: THIRTY_SECONDS,
        // Refetch when the user returns to the tab, so figures don't go stale.
        refetchOnWindowFocus: true,
        // One retry for a flaky connection; more would delay error messages.
        retry: 1,
      },
    },
  })
}
