/**
 * Tests for the Ask CoNote AI chat (FR-AI-1, FR-AI-4, FR-AI-5).
 */

// Queries and waiting.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real providers.
import { AppProviders } from '@/app/AppProviders'
// Replies, for expectations.
import { cannedReply, suggestedPrompts } from '@/lib/aiReplies'
// The error type.
import { AppError } from '@/lib/errors'
// Service types.
import type { AiService } from '@/services/types'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Demo services and a test cache.
import { createTestQueryClient, createTestServices } from '@/test/renderWithRouter'

// The unit under test.
import { ChatPanel } from './ChatPanel'

/** Renders the chat for all courses, with an optional AI service. */
function renderChat(ai?: AiService) {
  const services = { ...createTestServices(), ...(ai ? { ai } : {}) }
  const result = render(
    <AppProviders services={services} queryClient={createTestQueryClient()}>
      <ChatPanel context={{ scope: 'all' }} />
    </AppProviders>,
  )
  return { ...result, user: userEvent.setup() }
}

/** The message box. */
function input() {
  return screen.getByRole('textbox', { name: 'Ask a question' })
}

describe('ChatPanel', () => {
  // Proves an empty conversation offers the suggested prompts, and one click asks it.
  it('asks a suggested prompt', async () => {
    // Arrange.
    const { user } = renderChat()
    const [prompt = ''] = suggestedPrompts({ scope: 'all' })

    // Act.
    await user.click(screen.getByRole('button', { name: prompt }))

    // Assert: the question and the prepared answer are in the conversation.
    const log = screen.getByRole('log', { name: 'Conversation' })
    expect(within(log).getByText(prompt)).toBeInTheDocument()
    expect(await within(log).findByText(cannedReply(prompt))).toBeInTheDocument()
    // The prompts go once the conversation has started.
    expect(screen.queryByRole('button', { name: prompt })).toBeNull()
  })

  // Proves Enter sends and Shift+Enter adds a line (FR-AI-1).
  it('sends with Enter and adds a line with Shift+Enter', async () => {
    // Arrange.
    const { user } = renderChat()

    // Act: two lines, then Enter.
    await user.type(input(), 'line one{Shift>}{Enter}{/Shift}line two')
    expect(input()).toHaveValue('line one\nline two')
    await user.keyboard('{Enter}')

    // Assert: sent, and the box is empty again.
    expect(input()).toHaveValue('')
    expect(within(screen.getByRole('log')).getByText(/line one/)).toBeInTheDocument()
  })

  // Proves an empty message isn't sent.
  it('does not send an empty message', async () => {
    // Arrange.
    const { user } = renderChat()

    // Act.
    await user.type(input(), '   {Enter}')

    // Assert.
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(within(screen.getByRole('log')).queryAllByRole('listitem')).toHaveLength(0)
  })

  // Proves the typing indicator while waiting (FR-AI-5).
  it('shows a typing indicator while waiting', async () => {
    // Arrange: an AI that never answers.
    const { user } = renderChat({ askAi: () => new Promise(() => undefined) })

    // Act.
    await user.type(input(), 'Hello{Enter}')

    // Assert.
    expect(screen.getByText('CoNote AI is typing…')).toBeInTheDocument()
    expect(input()).toBeDisabled()
  })

  // Proves a failure shows inline with Retry, and Retry asks again (FR-AI-5).
  it('retries after an error', async () => {
    // Arrange: fails once, then answers.
    let calls = 0
    const { user } = renderChat({
      askAi: () => {
        calls += 1
        return calls === 1
          ? Promise.reject(new AppError('network', 'offline'))
          : Promise.resolve('Answer.')
      },
    })
    await user.type(input(), 'Hello{Enter}')

    // Assert: the error.
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't reach CoNote/)

    // Act.
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    // Assert: answered, once more, with the question kept.
    expect(await screen.findByText('Answer.')).toBeInTheDocument()
    expect(calls).toBe(2)
    expect(within(screen.getByRole('log')).getAllByText('Hello')).toHaveLength(1)
  })

  // SECURITY: proves messages are shown as text, so markup in a reply can't run (XSS).
  it('shows replies as plain text', async () => {
    // Arrange.
    const { user, container } = renderChat({
      askAi: () => Promise.resolve('<img src=x onerror="alert(1)">'),
    })

    // Act.
    await user.type(input(), 'Hi{Enter}')

    // Assert.
    expect(await screen.findByText('<img src=x onerror="alert(1)">')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  // Proves the FR-AI-4 disclaimer.
  it('shows the disclaimer', () => {
    // Act.
    renderChat()

    // Assert.
    expect(
      screen.getByText(
        'Answers are based on approved summaries and your notes. Check important details with your teacher.',
      ),
    ).toBeInTheDocument()
  })

  // Proves the chat passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Arrange.
    const { user, container } = renderChat()
    await user.type(input(), 'Hi{Enter}')
    await waitFor(() => {
      expect(within(screen.getByRole('log')).getAllByRole('listitem')).toHaveLength(2)
    })

    // Assert.
    await expectNoAxeViolations(container)
  })
})
