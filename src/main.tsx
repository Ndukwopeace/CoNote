/**
 * The app's entry point: loads the styles, builds the router and services, and renders the app
 * into index.html's #root element.
 */

// Plus Jakarta Sans, served from CoNote itself (decision D23): works offline, and no request
// goes to a font server. The variable file covers every weight the app uses (400 to 800).
import '@fontsource-variable/plus-jakarta-sans/wght.css'
// Global styles and design tokens, loaded once for the whole app.
import './styles/globals.css'

// Development-only extra checks (double renders, deprecated APIs).
import { StrictMode } from 'react'
// React's renderer for the browser.
import { createRoot } from 'react-dom/client'
// Creates a router that uses real browser addresses.
import { createBrowserRouter } from 'react-router'
// Connects the router to React.
import { RouterProvider } from 'react-router/dom'

// All app-wide providers.
import { AppProviders } from '@/app/AppProviders'
// The query cache factory.
import { createQueryClient } from '@/app/queryClient'
// The route table.
import { routes } from '@/app/routes'
// Picks mock or Supabase services.
import { createServices } from '@/app/createServices'
// Catches the browser's install offer (FR-PWA-6).
import { installPromptStore } from '@/features/pwa/installPrompt'
// The checked environment variables (importing this validates them).
import { env } from '@/lib/env'

// The element index.html provides for the app.
const container = document.getElementById('root')
// Without it nothing can render; fail with a message that says why.
if (!container) throw new Error('Missing #root element in index.html')

// Listen for the install offer now: Chrome sends it early, often before any menu exists.
installPromptStore.start(window)

// One router for the whole app.
const router = createBrowserRouter(routes)

// Render the app.
createRoot(container).render(
  <StrictMode>
    {/* Services for the configured data source, and a fresh query cache. */}
    <AppProviders services={createServices(env)} queryClient={createQueryClient()}>
      {/* The pages. */}
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
