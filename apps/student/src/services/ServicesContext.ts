/**
 * The React context that carries the service implementations. Kept in its own file so the
 * provider component and the hook can live in separate files (fast refresh needs that).
 */

// React's context factory.
import { createContext } from 'react'

// The type of what the context holds.
import type { Services } from './types'

// Starts as null; useServices() turns a missing provider into a clear error.
export const ServicesContext = createContext<Services | null>(null)
