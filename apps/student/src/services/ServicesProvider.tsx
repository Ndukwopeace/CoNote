/**
 * Puts the chosen service implementations into React context, so any component or hook below
 * can reach them without importing an implementation directly.
 */

// Type for "anything React can render", used for children.
import type { ReactNode } from 'react'

// The context this provider fills.
import { ServicesContext } from './ServicesContext'
// The shape of the services being provided.
import type { Services } from './types'

/** Injects the service implementations (ENGINEERING_STANDARDS.md 3.2, dependency injection). */
export function ServicesProvider({
  // The implementations: mock in the app today, fakes in tests.
  services,
  // The part of the app that can use them.
  children,
}: Readonly<{
  services: Services
  children: ReactNode
}>) {
  // React 19 lets a context object be used directly as its provider.
  return <ServicesContext value={services}>{children}</ServicesContext>
}
