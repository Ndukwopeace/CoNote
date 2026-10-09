/**
 * The one way UI code reaches the backend (ENGINEERING_STANDARDS.md 3.1).
 */

// Reads a context.
import { use } from 'react'

// The context.
import { ServicesContext } from './ServicesContext'

/** The services from the nearest ServicesProvider. Fails loudly if there is none. */
export function useServices() {
  const services = use(ServicesContext)
  // A missing provider is a wiring bug; say so instead of failing later with a vague error.
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>')
  return services
}
