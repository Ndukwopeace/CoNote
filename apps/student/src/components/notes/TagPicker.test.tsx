/**
 * Tests for the tag picker: preset tags and custom tags (FR-NTE-3).
 */

// Rendering, queries and user input.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// State for a controlled picker.
import { useState } from 'react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The unit under test.
import { TagPicker } from './TagPicker'

/** A picker holding its own state, starting with `initial`. */
function Harness({ initial = [] }: Readonly<{ initial?: string[] }>) {
  const [tags, setTags] = useState(initial)
  return (
    <>
      <TagPicker value={tags} onChange={setTags} />
      <p data-testid="value">{tags.join('|')}</p>
    </>
  )
}

/** The current tags as text. */
function value() {
  return screen.getByTestId('value').textContent
}

describe('TagPicker', () => {
  // Proves presets toggle on and off.
  it('toggles a preset tag', async () => {
    // Arrange.
    const user = userEvent.setup()
    render(<Harness />)
    const question = screen.getByRole('button', { name: 'Question' })
    // The presets are announced as one named group.
    expect(screen.getByRole('group', { name: 'Preset tags' })).toContainElement(question)

    // Act and assert: on.
    await user.click(question)
    expect(question).toHaveAttribute('aria-pressed', 'true')
    expect(value()).toBe('Question')

    // Act and assert: off.
    await user.click(question)
    expect(value()).toBe('')
  })

  // Proves a custom tag is added with Enter and removed with its button.
  it('adds and removes a custom tag', async () => {
    // Arrange.
    const user = userEvent.setup()
    render(<Harness />)

    // Act: add.
    await user.type(screen.getByRole('textbox', { name: 'Add your own tag' }), 'Exam{Enter}')

    // Assert.
    expect(value()).toBe('Exam')
    expect(screen.getByRole('textbox', { name: 'Add your own tag' })).toHaveValue('')

    // Act: remove.
    await user.click(screen.getByRole('button', { name: 'Remove tag Exam' }))

    // Assert.
    expect(value()).toBe('')
  })

  // Proves the picker explains why a tag wasn't added.
  it('explains a refused tag', async () => {
    // Arrange.
    const user = userEvent.setup()
    render(<Harness initial={['Exam']} />)

    // Act.
    await user.type(screen.getByRole('textbox', { name: 'Add your own tag' }), 'exam')
    await user.click(screen.getByRole('button', { name: 'Add tag' }))

    // Assert.
    expect(screen.getByText('That tag is already added.')).toBeInTheDocument()
    expect(value()).toBe('Exam')
  })

  // Proves the picker passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = render(<Harness initial={['Question', 'Exam']} />)

    // Assert.
    await expectNoAxeViolations(container)
  })
})
