/**
 * Makes the services available to everything below it.
 */

// Children type.
import type { ReactNode } from 'react'

// The context.
import { ServicesContext } from './ServicesContext'
// Service types.
import type { Services } from './types'

/** Provides `services` to the tree. */
export function ServicesProvider({
  services,
  children,
}: Readonly<{ services: Services; children: ReactNode }>) {
  return <ServicesContext value={services}>{children}</ServicesContext>
}
