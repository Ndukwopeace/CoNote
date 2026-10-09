/**
 * The admin app's entry point: loads the font and styles, builds the router and services, and
 * renders the console into #root.
 */

// The self-hosted Plus Jakarta Sans font, shared with the student app (D23).
import '@fontsource-variable/plus-jakarta-sans/wght.css'
// Tailwind and the CoNote design system.
import './styles/globals.css'

// Strict mode surfaces unsafe patterns during development.
import { StrictMode } from 'react'
// React's renderer for the browser.
import { createRoot } from 'react-dom/client'
// The data router.
import { createBrowserRouter } from 'react-router'
// Router provider for the DOM.
import { RouterProvider } from 'react-router/dom'

// Providers.
import { AppProviders } from '@/app/AppProviders'
// Services for the configured data source.
import { createServices } from '@/app/createServices'
// The query cache.
import { createQueryClient } from '@conote/portal'
// The route table.
import { routes } from '@/app/routes'
// Checked configuration.
import { env } from '@/lib/env'

// Where React renders. Fail loudly if index.html lost it.
const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element in index.html')

// The browser router over the route table.
const router = createBrowserRouter(routes)

// Render the console.
createRoot(container).render(
  <StrictMode>
    {/* Services for the configured data source, and a fresh query cache. */}
    <AppProviders services={createServices(env)} queryClient={createQueryClient()}>
      {/* The pages. */}
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
