/**
 * Tests for the note editor and its toolbar (FR-NTE-2).
 */

// Rendering, queries and user input.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Layout stand-ins the editor needs in jsdom.
import { installEditorDomStubs } from '@/test/editorDom'

// The unit under test.
import { RichTextEditor } from './RichTextEditor'

/** Renders the editor with a visible label and a change spy. */
function renderEditor(initialHtml = '<p>Hello</p>') {
  // Records every change.
  const onChange = vi.fn()
  const result = render(
    <>
      <span id="body-label">Note</span>
      <RichTextEditor
        id="body"
        labelledBy="body-label"
        initialHtml={initialHtml}
        onChange={onChange}
      />
    </>,
  )
  return { ...result, onChange, user: userEvent.setup() }
}

// The editor needs layout calls jsdom lacks.
installEditorDomStubs()

describe('RichTextEditor', () => {
  // Proves every FR-NTE-2 tool is there, by name.
  it('shows the formatting toolbar', () => {
    // Act.
    renderEditor()

    // Assert.
    const toolbar = screen.getByRole('toolbar', { name: 'Formatting' })
    for (const name of [
      'Bold',
      'Italic',
      'Underline',
      'Heading',
      'Bullet list',
      'Numbered list',
      'Link',
      'Undo',
      'Redo',
    ]) {
      expect(toolbar).toContainElement(screen.getByRole('button', { name }))
    }
  })

  // Proves the editable area is a labelled text box holding the starting content.
  it('shows the starting content in a labelled text box', () => {
    // Act.
    renderEditor('<p>Hello there</p>')

    // Assert.
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveTextContent('Hello there')
  })

  // Proves a toolbar command changes the HTML and marks the button as pressed.
  it('applies bold to the selection', async () => {
    // Arrange.
    const { user, onChange } = renderEditor('<p>Hello</p>')
    await user.click(screen.getByRole('textbox', { name: 'Note' }))
    await user.keyboard('{Control>}a{/Control}')

    // Act.
    await user.click(screen.getByRole('button', { name: 'Bold' }))

    // Assert.
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('<p><strong>Hello</strong></p>')
    })
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true')
  })

  // SECURITY: proves a script address is refused in the link box.
  it('refuses a javascript: link', async () => {
    // Arrange.
    const { user, onChange } = renderEditor('<p>Hello</p>')
    await user.click(screen.getByRole('button', { name: 'Link' }))

    // Act.
    await user.type(screen.getByRole('textbox', { name: 'Link address' }), 'javascript:alert(1)')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    // Assert.
    expect(screen.getByText(/Enter a web address/)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  // Proves the editor passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderEditor()

    // Assert.
    await expectNoAxeViolations(container)
  })
})
