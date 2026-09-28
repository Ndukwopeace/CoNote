/**
 * The hook every data hook uses to reach the services.
 */

// React 19's `use` reads a context value.
import { use } from 'react'

// The context filled by ServicesProvider.
import { ServicesContext } from './ServicesContext'

/** Returns the injected services. Throws if called outside ServicesProvider. */
export function useServices() {
  // Read whatever the nearest ServicesProvider supplied.
  const services = use(ServicesContext)
  // A missing provider is a programming mistake; fail with a message that says how to fix it.
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>')
  // Hand back the services.
  return services
}
