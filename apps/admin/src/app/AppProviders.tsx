/**
 * Everything the console needs around its pages: services, the query cache, sign-in state,
 * tooltip settings and toasts.
 */

// Query cache provider.
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
// Children type.
import type { ReactNode } from 'react'

// Short confirmations after a change.
import { ToastProvider } from '@conote/ui/toast'
// Tooltip settings for the icon rail.
import { TooltipProvider } from '@conote/ui/tooltip'

// Sign-in state.
import { AuthProvider } from '@/features/auth/AuthProvider'
// Services.
import { ServicesProvider } from '@/services/ServicesProvider'
// Service types.
import type { Services } from '@/services/types'

/** What the providers need. */
interface AppProvidersProps {
  services: Services
  queryClient: QueryClient
  children: ReactNode
}

/** Wraps the console in its providers, outermost first. */
export function AppProviders({ services, queryClient, children }: Readonly<AppProvidersProps>) {
  return (
    <ServicesProvider services={services}>
      {/* The query cache comes before AuthProvider, which clears it on sign-out. */}
      <QueryClientProvider client={queryClient}>
        {/* Sign-in state, available to every page. */}
        <AuthProvider>
          {/* Tooltip settings, toasts, then the console itself. */}
          <TooltipProvider>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ServicesProvider>
  )
}
