import './styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { AppProviders } from '@/app/AppProviders'
import { createQueryClient } from '@/app/queryClient'
import { routes } from '@/app/routes'
import { createServices } from '@/app/createServices'
import { env } from '@/lib/env'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element in index.html')

const router = createBrowserRouter(routes)

createRoot(container).render(
  <StrictMode>
    <AppProviders services={createServices(env)} queryClient={createQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
