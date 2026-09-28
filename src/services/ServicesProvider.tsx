import type { ReactNode } from 'react'

import { ServicesContext } from './ServicesContext'
import type { Services } from './types'

/** Injects the service implementations (ENGINEERING_STANDARDS.md 3.2, dependency injection). */
export function ServicesProvider({
  services,
  children,
}: {
  services: Services
  children: ReactNode
}) {
  return <ServicesContext value={services}>{children}</ServicesContext>
}
