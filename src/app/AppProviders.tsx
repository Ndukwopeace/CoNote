import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ServicesProvider } from '@/services/ServicesProvider'
import type { Services } from '@/services/types'

interface AppProvidersProps {
  services: Services
  queryClient: QueryClient
  children: ReactNode
}

/** Every app-wide provider, in one place, so tests render exactly what production renders. */
export function AppProviders({ services, queryClient, children }: AppProvidersProps) {
  return (
    <ServicesProvider services={services}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ServicesProvider>
  )
}
