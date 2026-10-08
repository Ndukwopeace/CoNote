/**
 * Tests for the user details page (admin REQUIREMENTS section 11): profile, courses and status
 * history; editing; status changes; reset links; and not-found.
 */

// Queries.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The routes, so the page renders inside the real layout.
import { routes } from '@/app/routes'
// The records the demo services read.
import { emptyPlatformData, userRecord, type PlatformData } from '@/services/platformData'
// Session builder.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** The platform: the signed-in admin and one enrolled student with a short history. */
function platform(): PlatformData {
  return emptyPlatformData({
    users: [
      userRecord({ id: 'admin-test', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({
        id: 's1',
        role: 'student',
        fullName: 'Ada Obi',
        email: 'ada@conote.example',
        studentNumber: 'U2023/5001',
        department: 'Computer Science',
        level: '200 Level',
        createdAt: new Date(2026, 8, 1, 10).toISOString(),
      }),
    ],
    courses: [
      { id: 'c1', code: 'CSC 101', title: 'Programming', teacherId: null, archivedAt: null },
    ],
    enrollments: [{ courseId: 'c1', studentId: 's1' }],
    auditLog: [
      {
        id: 'e1',
        at: new Date(2026, 8, 1, 10).toISOString(),
        actorId: 'admin-test',
        action: 'user.invited',
        entityType: 'user',
        entityId: 's1',
        metadata: { role: 'student', status: 'pending' },
      },
    ],
  })
}

/** Renders the details page for `userId`, as the signed-in admin. */
function renderDetails(userId = 's1') {
  return renderWithRouter({
    routes,
    path: `/admin/users/${userId}`,
    session: makeSession('admin', { fullName: 'Amara Okafor' }),
    platform: platform(),
  })
}

describe('UserDetailsPage', () => {
  // Proves the profile, courses and status history show, and no note content or note action.
  it('shows the profile, courses and history', async () => {
    // Act.
    const { container } = renderDetails()

    // Assert.
    expect(await screen.findByRole('heading', { level: 1, name: 'Ada Obi' })).toBeInTheDocument()
    expect(screen.getByText('U2023/5001')).toBeInTheDocument()
    expect(screen.getByText('200 Level')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'CSC 101 Programming' })).toHaveAttribute(
      'href',
      '/admin/courses/c1',
    )
    const history = screen.getByRole('list', { name: 'Status history' })
    expect(within(history).getByText('Invited')).toBeInTheDocument()
    expect(within(history).getByText(/by Amara Okafor/)).toBeInTheDocument()
    expect(screen.queryByText(/notes/i)).toBeNull()
    await expectNoAxeViolations(container)
  })

  // Proves an unknown ID shows its own message and the way back.
  it('says when the user does not exist', async () => {
    // Act.
    renderDetails('nobody')

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'User not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Users' })).toHaveAttribute(
      'href',
      '/admin/users',
    )
  })

  // Proves editing saves the profile.
  it('edits the profile', async () => {
    // Arrange.
    const { user } = renderDetails()
    await screen.findByRole('heading', { level: 1, name: 'Ada Obi' })

    // Act.
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit Ada Obi' })
    await user.clear(within(dialog).getByLabelText('Full name'))
    await user.type(within(dialog).getByLabelText('Full name'), 'Ada N. Obi')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    // Assert.
    expect(await screen.findByRole('heading', { level: 1, name: 'Ada N. Obi' })).toBeInTheDocument()
    expect(screen.getByText('Changes saved.')).toBeInTheDocument()
  })

  // Proves a status change after confirmation, recorded in the history.
  it('deactivates after confirmation', async () => {
    // Arrange.
    const { user } = renderDetails()
    await screen.findByRole('heading', { level: 1, name: 'Ada Obi' })

    // Act.
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Deactivate Ada Obi?' })
    await user.click(within(confirm).getByRole('button', { name: 'Deactivate' }))

    // Assert: the badge and the history.
    expect(await screen.findByText('Ada Obi is now inactive.')).toBeInTheDocument()
    const history = screen.getByRole('list', { name: 'Status history' })
    expect(await within(history).findByText('Inactive')).toBeInTheDocument()
  })

  // Proves the reset link is sent and confirmed.
  it('sends a password reset link', async () => {
    // Arrange.
    const { user } = renderDetails()
    await screen.findByRole('heading', { level: 1, name: 'Ada Obi' })

    // Act.
    await user.click(screen.getByRole('button', { name: 'Send password reset link' }))

    // Assert.
    expect(
      await screen.findByText('Password reset link sent to ada@conote.example.'),
    ).toBeInTheDocument()
  })

  // Proves administrators can't change their own status from their page.
  it('offers no status changes on your own account', async () => {
    // Act.
    renderDetails('admin-test')

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Amara Okafor' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).toBeNull()
    expect(screen.getByText('This is your account.')).toBeInTheDocument()
  })
})
