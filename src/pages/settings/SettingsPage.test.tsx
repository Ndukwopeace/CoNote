/**
 * Tests for Settings (FR-SET-1 to FR-SET-5): Profile, Account, Notifications, Privacy and Help.
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// User input, for an upload that ignores the input's accept list.
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Service types.
import type { Services } from '@/services/types'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Renders a settings tab, signed in. */
function renderTab(tab: string, services: Partial<Services> = {}) {
  return renderWithRouter({ routes, path: `/settings/${tab}`, session: makeSession(), services })
}

/** A small image file. */
function image(type: string, name = 'me.png') {
  return new File([new Uint8Array(20)], name, { type })
}

describe('Settings navigation', () => {
  // Proves the five sections are reachable and the current one is marked.
  it('links to the five sections', async () => {
    // Act.
    renderTab('account')

    // Assert.
    const nav = await screen.findByRole('navigation', { name: 'Settings sections' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Profile', 'Account', 'Notifications', 'Privacy', 'Help & Support'])
    expect(within(nav).getByRole('link', { name: 'Account' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

describe('Settings: Profile', () => {
  // Proves the profile loads, with the email read-only (FR-SET-1).
  it('shows the profile with a read-only email', async () => {
    // Act.
    renderTab('profile')

    // Assert.
    expect(await screen.findByRole('textbox', { name: 'Full name' })).toHaveValue('Victory Okafor')
    expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveAttribute('readonly')
  })

  // Proves saving shows a toast and updates the name in the navigation.
  it('saves changes', async () => {
    // Arrange.
    const { user } = renderTab('profile')
    const name = await screen.findByRole('textbox', { name: 'Full name' })

    // Act.
    await user.clear(name)
    await user.type(name, 'Victory Ada')
    await user.type(screen.getByRole('textbox', { name: /Department/ }), 'Computer Science')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    // Assert.
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: /account menu/i }),
    ).toHaveAccessibleName(/Victory Ada/)
  })

  // Proves field rules show inline.
  it('shows field errors', async () => {
    // Arrange.
    const { user } = renderTab('profile')
    await user.type(await screen.findByRole('textbox', { name: /Phone/ }), 'call me')

    // Act.
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    // Assert.
    expect(
      await screen.findByText('Enter a phone number using digits, spaces, + or -.'),
    ).toBeInTheDocument()
  })

  // Proves a picture previews before saving, and wrong files are refused.
  it('previews a picture and refuses other files', async () => {
    // Arrange.
    const { user } = renderTab('profile')
    const input = await screen.findByLabelText('Choose a picture')

    // Act: a PNG.
    await user.upload(input, image('image/png'))

    // Assert.
    expect(await screen.findByRole('img', { name: 'Preview of how you appear' })).toHaveAttribute(
      'src',
      expect.stringMatching(/^data:image\/png;base64,/),
    )

    // Act: an SVG (userEvent.upload respects accept, so turn that off for this check).
    await userEvent.setup({ applyAccept: false }).upload(input, image('image/svg+xml', 'x.svg'))

    // Assert.
    expect(await screen.findByText('Choose a JPG or PNG image.')).toBeInTheDocument()
  })
})

describe('Settings: Account', () => {
  // Proves a password change: mismatch reported, then success (FR-SET-2).
  it('changes the password', async () => {
    // Arrange.
    const { user } = renderTab('account')
    await user.type(await screen.findByLabelText('Current password', { exact: true }), 'old-pass1')
    await user.type(screen.getByLabelText('New password', { exact: true }), 'newpass12')
    await user.type(screen.getByLabelText('Confirm new password', { exact: true }), 'different1')

    // Act: mismatch.
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    // Assert.
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()

    // Act: fix it.
    const confirm = screen.getByLabelText('Confirm new password', { exact: true })
    await user.clear(confirm)
    await user.type(confirm, 'newpass12')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    // Assert: toast, and the fields are cleared.
    expect(await screen.findByText('Password changed.')).toBeInTheDocument()
    expect(screen.getByLabelText('Current password', { exact: true })).toHaveValue('')
  })

  // Proves the sign-in provider row and account deletion request (FR-SET-2).
  it('shows Google and requests deletion after confirmation', async () => {
    // Arrange.
    const { user } = renderTab('account')

    // Assert: provider.
    expect(await screen.findByText('Google')).toBeInTheDocument()

    // Act.
    await user.click(screen.getByRole('button', { name: 'Request account deletion' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Request account deletion?' })
    await user.click(within(dialog).getByRole('button', { name: 'Send request' }))

    // Assert.
    expect(await screen.findByText(/Your request has been sent/)).toBeInTheDocument()
  })

  // Proves Sign out is here too, and leaves the portal.
  it('signs out', async () => {
    // Arrange.
    const { user, router } = renderTab('account')

    // Act.
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    // Assert.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
  })
})

describe('Settings: Notifications', () => {
  // Proves the six switches reflect and save the settings (FR-SET-3).
  it('saves notification settings', async () => {
    // Arrange.
    const { user } = renderTab('notifications')
    const summaryEmail = await screen.findByRole('switch', { name: 'New summary published: email' })
    expect(screen.getAllByRole('switch')).toHaveLength(6)
    expect(summaryEmail).toBeChecked()

    // Act.
    await user.click(summaryEmail)
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    // Assert.
    expect(await screen.findByText('Notification settings saved.')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'New summary published: email' })).not.toBeChecked()
  })
})

describe('Settings: Privacy', () => {
  // Proves the explanation and the JSON download (FR-SET-4).
  it('explains privacy and downloads the notes as JSON', async () => {
    // Arrange: record the file handed to the browser (jsdom has no object URLs).
    const files: Blob[] = []
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        files.push(blob)
        return 'blob:notes'
      },
      revokeObjectURL: () => undefined,
    })
    const { user } = renderTab('privacy')

    // Assert: the explanation.
    expect(await screen.findByText(/Only you can read your notes/)).toBeInTheDocument()

    // Act.
    await user.click(screen.getByRole('button', { name: 'Download my notes' }))

    // Assert: one JSON file holding the 11 demo notes.
    await waitFor(() => {
      expect(files).toHaveLength(1)
    })
    expect(files[0]?.type).toBe('application/json')
    const parsed = JSON.parse(await files[0]!.text()) as { notes: unknown[] }
    expect(parsed.notes).toHaveLength(11)
  })
})

describe('Settings: Help & Support', () => {
  // Proves the FAQ, contact and version (FR-SET-5).
  it('shows the FAQ, contact email and version', async () => {
    // Arrange.
    const { user } = renderTab('help')

    // Assert: at least five questions, which open.
    const questions = await screen.findAllByRole('button', { expanded: false })
    expect(questions.length).toBeGreaterThanOrEqual(5)
    await user.click(screen.getByRole('button', { name: 'Who can see my notes?' }))
    expect(screen.getByRole('button', { name: 'Who can see my notes?' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('link', { name: /support@/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:/),
    )
    expect(screen.getByText(/Version \d+\.\d+\.\d+/)).toBeInTheDocument()
  })

  // Proves "Reset demo data" asks, then resets (mock mode only).
  it('resets demo data after confirmation', async () => {
    // Arrange: a demo service that records the call.
    const resetDemoData = vi.fn()
    const { user } = renderTab('help', { demo: { resetDemoData } })

    // Act.
    await user.click(await screen.findByRole('button', { name: 'Reset demo data' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reset' }),
    )

    // Assert.
    expect(resetDemoData).toHaveBeenCalledOnce()
  })

  // Proves the reset is hidden outside demo mode.
  it('hides the reset outside demo mode', async () => {
    // Act: the test services have no demo service.
    renderTab('help')

    // Assert.
    await screen.findByRole('heading', { level: 2, name: 'Help & Support' })
    expect(screen.queryByRole('button', { name: 'Reset demo data' })).toBeNull()
  })
})

describe('Settings accessibility', () => {
  // Proves each tab passes the automated accessibility rules.
  it.each(['profile', 'account', 'notifications', 'privacy', 'help'])(
    '%s has no violations',
    async (tab) => {
      // Act.
      const { container } = renderTab(tab)
      await screen.findAllByRole('heading', { level: 2 })
      await waitFor(() => {
        expect(screen.queryByText('Loading…')).toBeNull()
      })

      // Assert.
      await expectNoAxeViolations(container)
    },
  )
})
