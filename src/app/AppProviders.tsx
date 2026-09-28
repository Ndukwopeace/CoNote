/**
 * Every app-wide provider in one component. Production and tests both render this, so tests
 * exercise exactly the same setup the real app uses.
 */

// Provides the query cache; its client type.
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
// Type for anything React can render.
import type { ReactNode } from 'react'

// Shared tooltip timing for the whole app.
import { TooltipProvider } from '@/components/ui/tooltip'
// Sign-in state.
import { AuthProvider } from '@/features/auth/AuthProvider'
// Injected service implementations.
import { ServicesProvider } from '@/services/ServicesProvider'
// Their type.
import type { Services } from '@/services/types'

/** What the providers need from the caller. */
interface AppProvidersProps {
  // Mock services in the app today; fakes in tests.
  services: Services
  // The query cache.
  queryClient: QueryClient
  // The rest of the app.
  children: ReactNode
}

/** Every app-wide provider, in one place, so tests render exactly what production renders. */
export function AppProviders({ services, queryClient, children }: AppProvidersProps) {
  return (
    // Outermost: services, because AuthProvider needs them.
    <ServicesProvider services={services}>
      {/* Next: the query cache, because AuthProvider clears it on sign-out. */}
      <QueryClientProvider client={queryClient}>
        {/* Sign-in state, available to every page. */}
        <AuthProvider>
          {/* Tooltip settings, then the app itself. */}
          <TooltipProvider>{children}</TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ServicesProvider>
  )
}
