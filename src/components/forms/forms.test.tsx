/**
 * Tests for the shared form building blocks: the labelled field and the password input.
 */

// Rendering and queries.
import { render, screen } from '@testing-library/react'
// Simulated user input.
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'

// The components under test.
import { FormField } from './FormField'
import { PasswordInput } from './PasswordInput'

describe('FormField', () => {
  // Proves the label names the input, so screen readers announce it.
  it('labels its input', () => {
    // Act.
    render(
      <FormField id="email" label="Email address">
        {(field) => <input {...field} />}
      </FormField>,
    )

    // Assert.
    expect(screen.getByLabelText('Email address')).toHaveAttribute('id', 'email')
  })

  // Proves an error is shown, marks the input invalid, and is read out with the input.
  it('marks the input invalid and links it to the error message', async () => {
    // Act.
    const { container } = render(
      <FormField id="email" label="Email address" error="Enter a valid email address.">
        {(field) => <input {...field} />}
      </FormField>,
    )

    // Assert: invalid, and the error is its description.
    const input = screen.getByLabelText('Email address')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter a valid email address.')
    // Assert: no accessibility problems.
    await expectNoAxeViolations(container)
  })

  // Proves a valid field carries no error attributes.
  it('leaves a valid input unmarked', () => {
    // Act.
    render(
      <FormField id="email" label="Email address">
        {(field) => <input {...field} />}
      </FormField>,
    )

    // Assert.
    const input = screen.getByLabelText('Email address')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
  })
})

describe('PasswordInput', () => {
  // Proves the show/hide toggle (FR-AUTH-1) switches what is shown and reports its state.
  it('shows and hides the password', async () => {
    // Arrange.
    const user = userEvent.setup()
    render(<PasswordInput aria-label="Password" />)
    const input = screen.getByLabelText('Password')
    const toggle = screen.getByRole('button', { name: 'Show password' })

    // Starts hidden.
    expect(input).toHaveAttribute('type', 'password')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    // Act: show.
    await user.click(toggle)
    // Assert: visible, and the button says it is pressed.
    expect(input).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    // Act: hide again.
    await user.click(toggle)
    // Assert: hidden.
    expect(input).toHaveAttribute('type', 'password')
  })

  // Proves the toggle never submits the form it sits in.
  it('does not submit the form when toggled', async () => {
    // Arrange: count submissions.
    const user = userEvent.setup()
    let submitted = 0
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submitted += 1
        }}
      >
        <PasswordInput aria-label="Password" />
      </form>,
    )

    // Act.
    await user.click(screen.getByRole('button', { name: 'Show password' }))

    // Assert.
    expect(submitted).toBe(0)
  })
})
