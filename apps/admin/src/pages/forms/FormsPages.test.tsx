/**
 * Tests for the Forms pages (D126): the list, the builder with its preview, and the results with the
 * answers, the filter, deleting, the CSV, and the empty, error and not-found states.
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// Accessibility check, and the failure type.
import { AppError } from '@conote/core/errors'
import { expectNoAxeViolations } from '@conote/testing/axe'

// The routes, so the pages render inside the real layout.
import { routes } from '@/app/routes'
// The records the demo services read.
import {
  courseRecord,
  emptyPlatformData,
  userRecord,
  type FormRecord,
  type FormResponseRecord,
  type PlatformData,
} from '@/services/platformData'
import type { Services } from '@/services/types'
import type { AdminFormService } from '@/types/forms'
// Session builder.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

const FORM: FormRecord = {
  id: 'f1',
  token: 'a'.repeat(32),
  title: 'Lecturer assessment',
  description: 'Rate one course.',
  accepting: true,
  opensAt: null,
  closesAt: null,
  createdAt: '2026-11-10T09:00:00.000Z',
  questions: [
    { id: 'ql', kind: 'lecturer', prompt: 'Course and lecturer', required: true, options: [] },
    { id: 'q1', kind: 'rating', prompt: 'Explains clearly', required: true, options: [] },
    { id: 'q2', kind: 'rating', prompt: 'Is prepared', required: true, options: [] },
    { id: 'qc', kind: 'paragraph', prompt: 'What could improve?', required: false, options: [] },
  ],
}

/** One answer with the fields a test cares about overridden. */
function response(overrides: Partial<FormResponseRecord> & { id: string }): FormResponseRecord {
  return {
    formId: 'f1',
    createdAt: '2026-11-11T09:00:00.000Z',
    courseCode: 'MTH 202',
    lecturer: 'Dr. Smith',
    answers: { q1: 5, q2: 4 },
    ...overrides,
  }
}

/** An administrator, two courses with lecturers, one form, and three answers. */
function platform(overrides: Partial<PlatformData> = {}): PlatformData {
  return emptyPlatformData({
    users: [userRecord({ id: 'admin-test', role: 'admin', fullName: 'Amara Okafor' })],
    courses: [
      courseRecord({
        id: 'c1',
        code: 'MTH 202',
        title: 'Linear Algebra',
        lecturers: ['Dr. Smith', 'Dr. Jones'],
      }),
    ],
    forms: [FORM],
    formResponses: [
      response({ id: 'r1', answers: { q1: 5, q2: 4, qc: 'Very clear' } }),
      response({ id: 'r2', answers: { q1: 3, q2: 2 }, createdAt: '2026-11-12T09:00:00.000Z' }),
      response({
        id: 'r3',
        lecturer: 'Dr. Jones',
        answers: { q1: 1, q2: 1 },
        createdAt: '2026-11-13T09:00:00.000Z',
      }),
    ],
    ...overrides,
  })
}

/** Renders the console at `path`, signed in as the test administrator. */
function renderForms(path: string, data = platform(), overrides?: Partial<Services>) {
  return renderWithRouter({
    routes,
    path,
    session: makeSession('admin'),
    platform: data,
    ...(overrides ? { overrides } : {}),
  })
}

/** A form service whose calls all fail with a message that names a table. */
function failingForms(): AdminFormService {
  const fail = () => Promise.reject(new AppError('unknown', 'relation "forms" does not exist'))
  return {
    listForms: fail,
    getForm: fail,
    saveForm: fail,
    deleteForm: fail,
    getSummary: fail,
    listResponses: fail,
    deleteResponse: fail,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FormsPage', () => {
  // Proves each form shows its title, state, response count and a link to its results.
  it('lists the forms with their state and response count', async () => {
    renderForms('/admin/forms')

    const list = await screen.findByRole('list', { name: 'Forms' })

    expect(within(list).getByRole('link', { name: 'Lecturer assessment' })).toBeVisible()
    expect(within(list).getByText('Open')).toBeVisible()
    expect(within(list).getByRole('link', { name: '3 responses' })).toHaveAttribute(
      'href',
      '/admin/forms/f1/results',
    )
  })

  // Proves "New form" makes a form from the template and opens it in the builder.
  it('makes a new form from the template and opens it', async () => {
    const { user, router } = renderForms('/admin/forms', platform({ forms: [], formResponses: [] }))
    await screen.findByText('No forms yet.')

    await user.click(screen.getByRole('button', { name: 'New form' }))

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/admin\/forms\/form-/)
    })
    expect(await screen.findByLabelText('Title')).toHaveValue('Lecturer assessment')
    expect(screen.getByLabelText('Question 1')).toHaveValue('Course and lecturer')
  })

  // Proves an empty list says so, and a failure shows a safe message with no table name.
  it('has an empty state and an error state', async () => {
    const view = renderForms('/admin/forms', platform({ forms: [], formResponses: [] }))
    expect(await screen.findByText('No forms yet.')).toBeVisible()
    view.unmount()

    renderForms('/admin/forms', platform(), { forms: failingForms() })
    expect(await screen.findByText('Unable to load forms.')).toBeVisible()
    expect(screen.queryByText(/relation/)).toBeNull()
  })

  // Proves the list passes the accessibility check.
  it('has no accessibility violations', async () => {
    const { container } = renderForms('/admin/forms')
    await screen.findByRole('list', { name: 'Forms' })

    await expectNoAxeViolations(container)
  })
})

describe('FormEditorPage', () => {
  // Proves the builder shows the form's settings, questions in order, the share link and a preview.
  it('shows the form with its questions, link and preview', async () => {
    renderForms('/admin/forms/f1')

    expect(await screen.findByLabelText('Title')).toHaveValue('Lecturer assessment')
    expect(screen.getByLabelText('Question 2')).toHaveValue('Explains clearly')
    expect(screen.getByLabelText('Link to share')).toHaveValue(`/f/${'a'.repeat(32)}`)
    const preview = screen.getByRole('region', { name: 'Preview' })
    expect(within(preview).getByText('This is a preview. Nothing you enter is sent.')).toBeVisible()
    expect(within(preview).getByLabelText(/Course and lecturer/)).toBeVisible()
  })

  // Proves changes are saved: a new title, and a new question that gets its own ID.
  it('saves a change and a new question', async () => {
    const { user } = renderForms('/admin/forms/f1', platform({ formResponses: [] }))
    await user.clear(await screen.findByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Term 1 assessment')
    await user.selectOptions(screen.getByLabelText('New question type'), 'short')
    await user.click(screen.getByRole('button', { name: 'Add question' }))
    await user.type(screen.getByLabelText('Question 5'), 'Your level')

    await user.click(screen.getByRole('button', { name: 'Save form' }))

    expect(await screen.findByText('Saved.')).toBeVisible()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Term 1 assessment' }),
    ).toBeVisible()
    expect(screen.getByLabelText('Question 5')).toHaveValue('Your level')
  })

  // Proves a problem is explained and nothing is saved.
  it('explains a problem before saving', async () => {
    const { user } = renderForms('/admin/forms/f1')
    await user.clear(await screen.findByLabelText('Title'))

    await user.click(screen.getByRole('button', { name: 'Save form' }))

    expect(await screen.findByText('Give the form a title.')).toBeVisible()
  })

  // Proves a question can be moved and removed, and a second lecturer question is not on offer.
  it('moves and removes questions, and offers one lecturer question only', async () => {
    const { user } = renderForms('/admin/forms/f1', platform({ formResponses: [] }))
    await screen.findByLabelText('Title')

    await user.click(screen.getByRole('button', { name: 'Move question 3 up' }))
    expect(screen.getByLabelText('Question 2')).toHaveValue('Is prepared')
    await user.click(screen.getByRole('button', { name: 'Remove question 2' }))
    expect(screen.queryByDisplayValue('Is prepared')).toBeNull()
    const kinds = within(screen.getByLabelText('New question type'))
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(kinds).not.toContain('Course and lecturer')
  })

  // Proves answered questions are locked: no removal, and the type is fixed.
  it('locks the questions of a form that has answers', async () => {
    renderForms('/admin/forms/f1')

    expect(await screen.findByRole('button', { name: 'Remove question 2' })).toBeDisabled()
    expect(screen.getByLabelText('Type of question 2')).toBeDisabled()
    expect(screen.getAllByText(/This question has answers/).length).toBeGreaterThan(0)
  })

  // Proves a form is deleted after a confirmation, with the number of answers named.
  it('deletes a form after confirming', async () => {
    const { user, router } = renderForms('/admin/forms/f1')
    await user.click(await screen.findByRole('button', { name: 'Delete form' }))

    expect(screen.getByText('This deletes the form and its 3 responses for good.')).toBeVisible()
    await user.click(screen.getAllByRole('button', { name: 'Delete form' }).at(-1)!)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/forms')
    })
  })

  // Proves an unknown form says so.
  it('says when the form is not found', async () => {
    renderForms('/admin/forms/nope')

    expect(await screen.findByText(/We could not find that form/)).toBeVisible()
  })

  // Proves the builder passes the accessibility check.
  it('has no accessibility violations', async () => {
    const { container } = renderForms('/admin/forms/f1')
    await screen.findByLabelText('Title')

    await expectNoAxeViolations(container)
  })
})

describe('FormResultsPage', () => {
  // Proves the averages per lecturer, with an overall figure, and the count of responses.
  it('shows the results by course and lecturer', async () => {
    renderForms('/admin/forms/f1/results')

    const table = await screen.findByRole('table', { name: 'Results by course and lecturer' })
    const rows = within(table).getAllByRole('row').slice(1)

    expect(rows).toHaveLength(2)
    // Dr. Jones: one answer, ratings 1 and 1. Dr. Smith: two answers, averages 4 and 3, overall 3.5.
    expect(within(rows[0]!).getByText('Dr. Jones')).toBeVisible()
    expect(within(rows[0]!).getAllByText('1.00').length).toBeGreaterThan(0)
    expect(within(rows[1]!).getByText('Dr. Smith')).toBeVisible()
    expect(within(rows[1]!).getByText('4.00')).toBeVisible()
    expect(within(rows[1]!).getByText('3.00')).toBeVisible()
    expect(within(rows[1]!).getByText('3.50')).toBeVisible()
  })

  // Proves answers are listed newest first with their comments, as text.
  it('lists the answers, newest first, with comments as text', async () => {
    renderForms(
      '/admin/forms/f1/results',
      platform({
        formResponses: [
          response({
            id: 'r1',
            answers: { q1: 5, q2: 4, qc: '<img src=x onerror="window.hacked=1">' },
          }),
        ],
      }),
    )

    const list = await screen.findByRole('list', { name: 'Responses' })

    expect(within(list).getByText(/<img src=x/)).toBeVisible()
    expect(document.querySelector('img')).toBeNull()
  })

  // Proves the filter narrows the answers to one course and lecturer.
  it('narrows the answers by course and lecturer', async () => {
    const { user } = renderForms('/admin/forms/f1/results')
    await screen.findByRole('list', { name: 'Responses' })

    await user.selectOptions(screen.getByLabelText('Course and lecturer'), 'MTH 202\u0000Dr. Jones')

    await waitFor(() => {
      expect(
        within(screen.getByRole('list', { name: 'Responses' })).getAllByRole('listitem'),
      ).toHaveLength(1)
    })
  })

  // Proves one answer is deleted after a confirmation, and the results follow.
  it('deletes one answer after confirming', async () => {
    const { user } = renderForms('/admin/forms/f1/results')
    const list = await screen.findByRole('list', { name: 'Responses' })

    await user.click(within(list).getAllByRole('button', { name: 'Delete this response' })[0]!)
    await user.click(screen.getByRole('button', { name: 'Delete response' }))

    await waitFor(() => {
      expect(
        within(screen.getByRole('list', { name: 'Responses' })).getAllByRole('listitem'),
      ).toHaveLength(2)
    })
  })

  // Proves the CSV is built from every answer and handed to the browser as a download.
  it('downloads the answers as a CSV file', async () => {
    const create = vi.fn(() => 'blob:csv')
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() })
    const { user } = renderForms('/admin/forms/f1/results')
    await screen.findByRole('list', { name: 'Responses' })

    await user.click(screen.getByRole('button', { name: 'Download CSV' }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1)
    })
    const blob = (create.mock.calls[0] as unknown as [Blob])[0]
    expect(blob.type).toBe('text/csv;charset=utf-8')
    expect(blob.size).toBeGreaterThan(50)
  })

  // Proves a form with no answers says so, and the download is off.
  it('has an empty state', async () => {
    renderForms('/admin/forms/f1/results', platform({ formResponses: [] }))

    expect(await screen.findByText('No responses yet.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeDisabled()
  })

  // Proves a failure shows a safe message, and an unknown form says so.
  it('has an error state and a not-found state', async () => {
    const view = renderForms('/admin/forms/f1/results', platform(), { forms: failingForms() })
    expect(await screen.findByText('Unable to load the form.')).toBeVisible()
    expect(screen.queryByText(/relation/)).toBeNull()
    view.unmount()

    renderForms('/admin/forms/nope/results')
    expect(await screen.findByText(/We could not find that form/)).toBeVisible()
  })

  // Proves the results pass the accessibility check.
  it('has no accessibility violations', async () => {
    const { container } = renderForms('/admin/forms/f1/results')
    await screen.findByRole('table')
    await screen.findByRole('list', { name: 'Responses' })

    await expectNoAxeViolations(container)
  })
})
