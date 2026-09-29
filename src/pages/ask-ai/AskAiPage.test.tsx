/**
 * Tests for the Ask CoNote AI page (FR-AI-1, FR-AI-2).
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// The prompts, for expectations.
import { suggestedPrompts } from '@/lib/aiReplies'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Renders the page at `path`, signed in. */
function renderAi(path = '/ask-ai') {
  return renderWithRouter({ routes, path, session: makeSession() })
}

/** The context picker. */
function picker() {
  return screen.getByRole('combobox', { name: 'Context' })
}

describe('AskAiPage', () => {
  // Proves the default context and its prompts.
  it('starts on all courses', async () => {
    // Act.
    renderAi()

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ask CoNote AI' }),
    ).toBeInTheDocument()
    expect(await screen.findByRole('combobox', { name: 'Context' })).toHaveValue('all')
    expect(
      screen.getByRole('button', { name: suggestedPrompts({ scope: 'all' })[0] ?? '' }),
    ).toBeInTheDocument()
  })

  // Proves the context is preset from the address (FR-AI-2).
  it('presets the context from the address', async () => {
    // Act.
    renderAi('/ask-ai?classId=swe-311-c2')

    // Assert.
    expect(await screen.findByRole('combobox', { name: 'Context' })).toHaveValue('class:swe-311-c2')
    expect(
      screen.getByRole('button', { name: suggestedPrompts({ scope: 'class' })[0] ?? '' }),
    ).toBeInTheDocument()
  })

  // Proves changing context before any message just switches, and updates the address.
  it('switches context straight away when the conversation is empty', async () => {
    // Arrange.
    const { user, router } = renderAi()
    await screen.findByRole('combobox', { name: 'Context' })

    // Act.
    await user.selectOptions(picker(), 'course:eng-201')

    // Assert.
    expect(router.state.location.search).toBe('?courseId=eng-201')
    expect(
      screen.getByRole('button', { name: suggestedPrompts({ scope: 'course' })[0] ?? '' }),
    ).toBeInTheDocument()
  })

  // Proves changing context mid-conversation asks first, and confirming starts afresh (FR-AI-2).
  it('asks before changing context mid-conversation', async () => {
    // Arrange: one exchange.
    const { user } = renderAi()
    await screen.findByRole('combobox', { name: 'Context' })
    await user.type(screen.getByRole('textbox', { name: 'Ask a question' }), 'Hello{Enter}')
    await waitFor(() => {
      expect(within(screen.getByRole('log')).getAllByRole('listitem')).toHaveLength(2)
    })

    // Act: change, then cancel.
    await user.selectOptions(picker(), 'course:eng-201')
    const dialog = await screen.findByRole('alertdialog', { name: 'Start a new conversation?' })
    expect(dialog).toHaveTextContent('Changing the context starts a new conversation.')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    // Assert: nothing changed.
    expect(picker()).toHaveValue('all')
    expect(within(screen.getByRole('log')).getAllByRole('listitem')).toHaveLength(2)

    // Act: change, then confirm.
    await user.selectOptions(picker(), 'course:eng-201')
    await user.click(await screen.findByRole('button', { name: 'Start new conversation' }))

    // Assert: new context, empty conversation.
    expect(picker()).toHaveValue('course:eng-201')
    expect(within(screen.getByRole('log')).queryAllByRole('listitem')).toHaveLength(0)
  })

  // Proves the page passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderAi()
    await screen.findByRole('combobox', { name: 'Context' })

    // Assert.
    await expectNoAxeViolations(container)
  })
})
