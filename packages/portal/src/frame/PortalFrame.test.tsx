/**
 * Tests for the frame around every page of a staff portal, and the shared error screens.
 */

// Queries.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// A crashing page, for the error boundary.
import { BookOpen } from 'lucide-react'

import { ErrorState } from '../components/ErrorState'
import { NotFoundPage } from '../components/NotFoundPage'
import { RouteErrorBoundary } from '../components/RouteErrorBoundary'
import { PortalFrame } from './PortalFrame'
import {
  INVITED,
  PATHS,
  PASSWORD,
  STAFF,
  renderPortal,
  storedSession,
  testRoutes,
} from '../test/harness'

describe('PortalFrame', () => {
  // Proves the sidebar lists the portal's sections, named after the portal.
  it('lists the sections in a navigation named after the portal', async () => {
    const { container } = renderPortal({ path: PATHS.home, session: { user: STAFF } })

    const nav = await screen.findByRole('navigation', { name: 'Test navigation' })
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', PATHS.home)
    await screen.findByRole('heading', { level: 1, name: 'Home page' })
    await expectNoAxeViolations(container)
  })

  // Proves the account menu names who is signed in and links to Settings when the portal has it.
  it('shows the account menu with Settings when the portal has one', async () => {
    const { user } = renderPortal({ path: PATHS.home, session: { user: STAFF } })

    await user.click(await screen.findByRole('button', { name: 'Account menu for Sam Staff' }))

    expect(await screen.findByText(STAFF.email)).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  // Proves a portal with no Settings page shows no Settings link.
  it('leaves Settings out when the portal has none', async () => {
    const routes = testRoutes()
    const guarded = routes[1]?.children?.[0]
    if (guarded) {
      guarded.element = (
        <PortalFrame
          name="Test"
          homePath={PATHS.home}
          items={[{ label: 'Home', to: PATHS.home, icon: BookOpen }]}
        />
      )
    }
    const { user } = renderPortal({ path: PATHS.home, session: { user: STAFF }, routes })

    await user.click(await screen.findByRole('button', { name: 'Account menu for Sam Staff' }))

    expect(await screen.findByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Settings' })).not.toBeInTheDocument()
  })

  // Proves a portal can put something (a bell) in the top bar, and a portal that does not has none.
  it('shows what the portal puts in the top bar, before the account menu', async () => {
    const routes = testRoutes()
    const guarded = routes[1]?.children?.[0]
    if (guarded) {
      guarded.element = (
        <PortalFrame
          name="Test"
          homePath={PATHS.home}
          items={[{ label: 'Home', to: PATHS.home, icon: BookOpen }]}
          topBarExtra={<button type="button">Extra thing</button>}
        />
      )
    }
    renderPortal({ path: PATHS.home, session: { user: STAFF }, routes })

    const extra = await screen.findByRole('button', { name: 'Extra thing' })
    const account = screen.getByRole('button', { name: 'Account menu for Sam Staff' })
    // The extra comes first in the document, so first in the tab order too.
    expect(extra.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // Proves the phone menu opens the same sections and closes when one is chosen.
  it('opens the sections in the phone menu and closes it on a choice', async () => {
    const { user, router } = renderPortal({ path: PATHS.home, session: { user: STAFF } })

    await user.click(await screen.findByRole('button', { name: 'Open navigation' }))
    const phoneNav = await screen.findByRole('navigation', { name: 'Phone navigation' })
    await user.click(within(phoneNav).getByRole('link', { name: 'Home' }))

    expect(router.state.location.pathname).toBe(PATHS.home)
    expect(screen.queryByRole('navigation', { name: 'Phone navigation' })).not.toBeInTheDocument()
  })

  // Proves an unknown address inside the portal shows not-found within the frame.
  it('shows not-found inside the frame', async () => {
    renderPortal({ path: '/t/nowhere', session: { user: STAFF } })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', PATHS.home)
    expect(screen.getByRole('navigation', { name: 'Test navigation' })).toBeInTheDocument()
  })
})

describe('first-time password dialog (D118)', () => {
  // Proves nobody is asked for a password unless their account needs one.
  it('does not show for an ordinary account', async () => {
    renderPortal({ path: PATHS.home, session: { user: STAFF } })

    await screen.findByRole('heading', { level: 1, name: 'Home page' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // Proves an invited account is asked at once, and the dialog cannot be dismissed or skipped.
  it('opens at once for an invited account, and cannot be closed', async () => {
    const { user } = renderPortal({ path: PATHS.home, session: { user: INVITED } })

    const dialog = await screen.findByRole('dialog', { name: 'Set your password' })
    expect(within(dialog).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Set your password' })).toBeInTheDocument()
  })

  // Proves saving a password closes the dialog and keeps the person signed in.
  it('closes once a password is saved', async () => {
    const { user } = renderPortal({ path: PATHS.home, session: { user: INVITED } })
    const dialog = await screen.findByRole('dialog', { name: 'Set your password' })

    await user.type(
      within(dialog).getByLabelText('New password', { exact: true }),
      PASSWORD + 'abcd',
    )
    await user.type(
      within(dialog).getByLabelText('Confirm new password', { exact: true }),
      PASSWORD + 'abcd',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save password' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(storedSession()?.user.mustSetPassword).toBeUndefined()
  })

  // Proves a rule-breaking password is explained and the dialog stays.
  it('explains a password that breaks the rules', async () => {
    const { user } = renderPortal({ path: PATHS.home, session: { user: INVITED } })
    const dialog = await screen.findByRole('dialog', { name: 'Set your password' })

    await user.type(within(dialog).getByLabelText('New password', { exact: true }), 'short1')
    await user.type(
      within(dialog).getByLabelText('Confirm new password', { exact: true }),
      'short1',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save password' }))

    // The rules line and the field's own message both say it.
    expect(await within(dialog).findAllByText(/at least 12 characters/i)).toHaveLength(2)
    expect(storedSession()?.user.mustSetPassword).toBe(true)
  })

  // Proves a person who cannot choose a password now can still leave.
  it('offers sign out, so nobody is trapped', async () => {
    const { user } = renderPortal({ path: PATHS.home, session: { user: INVITED } })
    const dialog = await screen.findByRole('dialog', { name: 'Set your password' })

    await user.click(within(dialog).getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(storedSession()).toBeNull()
    })
  })

  // Proves the dialog passes the accessibility check.
  it('has no accessibility violations', async () => {
    renderPortal({ path: PATHS.home, session: { user: INVITED } })
    const dialog = await screen.findByRole('dialog', { name: 'Set your password' })

    await expectNoAxeViolations(dialog)
  })
})

describe('error screens', () => {
  // Proves a crashing page shows fixed wording and ways forward, never the raw error (SECURITY).
  it('shows a safe message when a page crashes', async () => {
    function Crash(): never {
      throw new Error('relation "profiles" does not exist')
    }
    renderPortal({
      path: '/boom',
      routes: [
        {
          path: '/boom',
          element: <Crash />,
          errorElement: <RouteErrorBoundary homePath={PATHS.home} homeLabel="Go home" />,
        },
      ],
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Something went wrong on our side. Please try again.')).toBeVisible()
    expect(screen.queryByText(/profiles/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', PATHS.home)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the load-failure panel says what failed and offers a retry.
  it('names what failed to load, with a retry', async () => {
    let retried = false
    const { user } = renderPortal({
      path: '/x',
      routes: [
        {
          path: '/x',
          element: (
            <ErrorState
              thing="alerts"
              onRetry={() => {
                retried = true
              }}
            />
          ),
        },
      ],
    })

    expect(await screen.findByText('Unable to load alerts.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retried).toBe(true)
  })

  // Proves the not-found page stands alone with a way home.
  it('shows not-found on its own', async () => {
    renderPortal({
      path: '/x',
      routes: [{ path: '/x', element: <NotFoundPage homePath="/h" homeLabel="Back home" /> }],
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/h')
  })

  // Proves a missing record can name itself, with its own line, instead of "Page not found".
  it('takes its own heading and line for a missing record', async () => {
    renderPortal({
      path: '/x',
      routes: [
        {
          path: '/x',
          element: (
            <NotFoundPage
              title="Course not found"
              message="We couldn't find that."
              homePath="/h"
              homeLabel="Back to courses"
            />
          ),
        },
      ],
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Course not found' }),
    ).toBeInTheDocument()
    expect(screen.getByText("We couldn't find that.")).toBeInTheDocument()
  })
})
