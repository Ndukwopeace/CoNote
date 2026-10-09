/**
 * The React context that carries the services to every page.
 */

// Context factory.
import { createContext } from 'react'

// Service types.
import type { Services } from './types'

/** The services, or null outside ServicesProvider (useServices turns that into an error). */
export const ServicesContext = createContext<Services | null>(null)
