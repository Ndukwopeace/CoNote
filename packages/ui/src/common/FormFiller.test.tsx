/**
 * Tests for the shared form filler (D126): each kind of question, the required marks, the checks before
 * a send, the thank-you and "Submit another response", a failed send, a preview, and accessibility.
 */

// Rendering, queries and user input.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The unit under test.
import { FormFiller, type FillerAnswers, type FillerForm } from './FormFiller'

const FORM: FillerForm = {
  title: 'Lecturer assessment',
  description: '',
  lecturers: [
    { courseId: 'c1', courseCode: 'MTH 202', courseTitle: 'Linear Algebra', lecturer: 'Dr. Smith' },
    { courseId: 'c1', courseCode: 'MTH 202', courseTitle: 'Linear Algebra', lecturer: 'Dr. Jones' },
    { courseId: 'c2', courseCode: 'PHY 101', courseTitle: 'Physics', lecturer: 'Dr. Ade' },
  ],
  questions: [
    { id: 'l', kind: 'lecturer', prompt: 'Course and lecturer', required: true, options: [] },
    { id: 'r', kind: 'rating', prompt: 'Explains clearly', required: true, options: [] },
    { id: 'c', kind: 'choice', prompt: 'Starts on time?', required: false, options: ['Yes', 'No'] },
    { id: 'd', kind: 'dropdown', prompt: 'Year', required: false, options: ['One', 'Two'] },
    { id: 's', kind: 'short', prompt: 'Your level', required: false, options: [] },
    { id: 'p', kind: 'paragraph', prompt: 'Comments', required: false, options: [] },
  ],
}

/** Renders the form with a send that succeeds, and a problem check that finds none. */
function renderFiller(
  props: Partial<React.ComponentProps<typeof FormFiller>> = {},
  onSubmit = vi.fn<(answers: FillerAnswers) => Promise<void>>(() => Promise.resolve()),
) {
  const view = render(
    <FormFiller form={FORM} onSubmit={onSubmit} problem={() => null} {...props} />,
  )
  return { ...view, onSubmit, user: userEvent.setup() }
}

describe('FormFiller', () => {
  // Proves every kind of question is drawn, and each answer reaches onSubmit under its question.
  it('collects an answer to every kind of question', async () => {
    const { user, onSubmit } = renderFiller()

    await user.selectOptions(screen.getByLabelText(/Course and lecturer/), 'c1::Dr. Jones')
    await user.click(screen.getByRole('radio', { name: '4 of 5, Very good' }))
    await user.click(screen.getByRole('radio', { name: 'Yes' }))
    await user.selectOptions(screen.getByLabelText('Year'), 'Two')
    await user.type(screen.getByLabelText('Your level'), '300')
    await user.type(screen.getByLabelText('Comments'), 'Clear lessons')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        l: { courseId: 'c1', lecturer: 'Dr. Jones' },
        r: 4,
        c: 'Yes',
        d: 'Two',
        s: '300',
        p: 'Clear lessons',
      })
    })
  })

  // Proves the lecturer dropdown groups its choices by course.
  it('groups the lecturers by course', () => {
    renderFiller()

    const select = screen.getByLabelText(/Course and lecturer/)

    expect(select.querySelectorAll('optgroup')).toHaveLength(2)
    expect(screen.getByRole('option', { name: 'PHY 101 · Dr. Ade' })).toBeInTheDocument()
  })

  // Proves required questions are marked for everyone, including screen readers.
  it('marks required questions', () => {
    renderFiller()

    expect(screen.getByLabelText(/Course and lecturer.*\(required\)/)).toBeInTheDocument()
    expect(screen.getAllByText('(required)').length).toBeGreaterThan(0)
  })

  // Proves a problem found before sending is shown and nothing is sent.
  it('shows a problem and sends nothing', async () => {
    const { user, onSubmit } = renderFiller({
      problem: () => '"Explains clearly" needs an answer.',
    })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('"Explains clearly" needs an answer.')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // Proves the thanks follows a send, and "Submit another response" gives a fresh, empty form.
  it('says thank you and starts again for another response', async () => {
    const { user } = renderFiller()
    await user.type(screen.getByLabelText('Your level'), '300')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Thank you. Your response was sent.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Submit another response' }))

    expect(screen.getByLabelText('Your level')).toHaveValue('')
  })

  // Proves a failed send shows the reason and keeps the answers.
  it('shows why a send failed and keeps the answers', async () => {
    const onSubmit = vi.fn(() =>
      Promise.reject(new Error('This form is not taking answers right now.')),
    )
    const { user } = renderFiller({}, onSubmit)
    await user.type(screen.getByLabelText('Your level'), '300')

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('This form is not taking answers right now.')).toBeVisible()
    expect(screen.getByLabelText('Your level')).toHaveValue('300')
  })

  // Proves a preview shows the form, says so, and sends nothing.
  it('sends nothing in a preview', async () => {
    const { user, onSubmit } = renderFiller({ preview: true })

    expect(screen.getByText('This is a preview. Nothing you enter is sent.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
    await user.type(screen.getByLabelText('Your level'), 'x')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // Proves the form passes the accessibility check.
  it('has no accessibility violations', async () => {
    const { container } = renderFiller()

    await expectNoAxeViolations(container)
  })
})
