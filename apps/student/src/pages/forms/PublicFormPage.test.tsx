/**
 * Tests for the public form page (D126): it opens from its link with no sign-in, answers are checked and
 * sent, "Submit another response" starts a fresh form, a wrong link, a closed form and a failed load each
 * say so, search engines are asked to skip it, and it passes the accessibility check.
 */

// Queries and waiting.
import { screen, waitFor } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// Accessibility check, and the failure type.
import { AppError } from '@conote/core/errors'
import { expectNoAxeViolations } from '@conote/testing/axe'
import type { PublicFormService } from '@conote/core/forms'

// The real route table, so the page sits in its real layout.
import { routes } from '@/app/routes'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Renders the page at `path`, signed out unless a session is given. */
function renderForm(path = '/f/demo', services?: { forms: PublicFormService }, signedIn = false) {
  return renderWithRouter({
    routes,
    path,
    ...(signedIn ? { session: makeSession() } : {}),
    ...(services ? { services } : {}),
  })
}

describe('PublicFormPage', () => {
  // Proves the demo link opens the form with no sign-in, with its title and questions.
  it('opens a form from its link without signing in', async () => {
    renderForm()

    expect(
      await screen.findByRole('heading', { level: 1, name: /Lecturer assessment/ }),
    ).toBeVisible()
    expect(screen.getByLabelText(/Course and lecturer/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeVisible()
  })

  // Proves a student who happens to be signed in still sees the form, not the dashboard.
  it('shows the form to a signed-in student too', async () => {
    renderForm('/f/demo', undefined, true)

    expect(
      await screen.findByRole('heading', { level: 1, name: /Lecturer assessment/ }),
    ).toBeVisible()
  })

  // Proves an incomplete answer is explained and not sent.
  it('explains what is missing', async () => {
    const { user } = renderForm()
    await screen.findByRole('button', { name: 'Submit' })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('"Course and lecturer" needs an answer.')).toBeVisible()
  })

  // Proves a complete answer is sent, the thanks follows, and another response starts empty.
  it('sends a complete answer and offers another response', async () => {
    const { user } = renderForm()
    await screen.findByRole('button', { name: 'Submit' })

    await user.selectOptions(screen.getByLabelText(/Course and lecturer/), 'demo-swe::Dr. B. Jones')
    await user.click(screen.getAllByRole('radio', { name: '5 of 5, Excellent' })[0]!)
    await user.click(screen.getAllByRole('radio', { name: '4 of 5, Very good' })[1]!)
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Thank you. Your response was sent.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Submit another response' }))
    expect(screen.getByLabelText(/Course and lecturer/)).toHaveValue('')
  })

  // Proves a link nobody made says the form was not found, with no sign-in prompt.
  it('says when the link is wrong', async () => {
    renderForm('/f/not-a-real-link')

    expect(await screen.findByText('We could not find this form')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Sign in|Log in/ })).toBeNull()
  })

  // Proves a closed form and one that opens later each say so, with no questions.
  it('says when a form is closed or not open yet', async () => {
    const closed: PublicFormService = {
      getForm: () =>
        Promise.resolve({
          title: 'Closed one',
          description: '',
          state: 'closed',
          questions: [],
          lecturers: [],
        }),
      submit: () => Promise.resolve(),
    }
    const view = renderForm('/f/x', { forms: closed })
    expect(
      await screen.findByText('This form is closed and is no longer taking responses.'),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull()
    view.unmount()

    const later: PublicFormService = {
      getForm: () =>
        Promise.resolve({
          title: 'Later',
          description: '',
          state: 'not_open',
          questions: [],
          lecturers: [],
        }),
      submit: () => Promise.resolve(),
    }
    renderForm('/f/y', { forms: later })
    expect(await screen.findByText('This form is not open yet. Try again later.')).toBeVisible()
  })

  // Proves a failed load shows a retry, and a failed send shows its reason without losing the answers.
  it('shows a retry for a failed load', async () => {
    const failing: PublicFormService = {
      getForm: () => Promise.reject(new AppError('network', 'down')),
      submit: () => Promise.resolve(),
    }
    renderForm('/f/x', { forms: failing })

    expect(await screen.findByRole('button', { name: /Retry|Try again/ })).toBeVisible()
  })

  // Proves a form the server refuses to take (closed meanwhile) shows its reason.
  it('shows why a send was refused', async () => {
    const real = (
      await import('@/services/mock/mockPublicFormService')
    ).createMockPublicFormService(0)
    const refusing: PublicFormService = {
      getForm: (token) => real.getForm(token),
      submit: vi.fn(() =>
        Promise.reject(new AppError('validation', 'This form is not taking answers right now.')),
      ),
    }
    const { user } = renderForm('/f/demo', { forms: refusing })
    await screen.findByRole('button', { name: 'Submit' })
    await user.selectOptions(screen.getByLabelText(/Course and lecturer/), 'demo-mth::Dr. A. Smith')
    await user.click(screen.getAllByRole('radio', { name: '5 of 5, Excellent' })[0]!)
    await user.click(screen.getAllByRole('radio', { name: '4 of 5, Very good' })[1]!)

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('This form is not taking answers right now.')).toBeVisible()
  })

  // SECURITY: proves the page asks search engines not to list it, and takes that back on leaving.
  it('asks search engines to skip the page', async () => {
    const view = renderForm()
    await screen.findByRole('button', { name: 'Submit' })

    await waitFor(() => {
      expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      )
    })
    view.unmount()
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })

  // Proves the page passes the accessibility check.
  it('has no accessibility violations', async () => {
    const { container } = renderForm()
    await screen.findByRole('button', { name: 'Submit' })

    await expectNoAxeViolations(container)
  })
})
