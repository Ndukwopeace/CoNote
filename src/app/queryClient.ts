import { QueryClient } from '@tanstack/react-query'

const THIRTY_SECONDS = 30_000

/** TanStack Query defaults (ENGINEERING_STANDARDS.md section 8). */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: THIRTY_SECONDS, refetchOnWindowFocus: true, retry: 1 },
    },
  })
}
