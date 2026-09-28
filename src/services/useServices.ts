import { use } from 'react'

import { ServicesContext } from './ServicesContext'

export function useServices() {
  const services = use(ServicesContext)
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>')
  return services
}
