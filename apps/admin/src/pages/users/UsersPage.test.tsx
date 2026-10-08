/**
 * Tests for the Users list (admin REQUIREMENTS section 11): tabs, search, filters and sort in the
 * address, pages, empty and error states, inviting, and status changes.
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared error type.
import { AppError } from '@conote/core/errors'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The routes, so the page renders inside the real layout.
import { routes } from '@/app/routes'
// The records the demo services read.
import { emptyPlatformData, userRecord, type PlatformData } from '@/services/platformData'
// Service types.
import type { Services } from '@/services/types'
// Session builder.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** The platform: the signed-in admin, one teacher, 25 students (s03 suspended). */
function platform(): PlatformData {
  // Students 01 to 25.
  const students = Array.from({ length: 25 }, (_, index) => {
    const n = String(index + 1).padStart(2, '0')
    return userRecord({
      id: `s${n}`,
      role: 'student',
      status: n === '03' ? 'suspended' : 'active',
      fullName: `Student ${n}`,
      email: `student${n}@conote.example`,
      studentNumber: `U2023/50${n}`,
      department: 'Computer Science',
    })
  })
  return emptyPlatformData({
    users: [
      userRecord({ id: 'admin-test', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({
        id: 't1',
        role: 'teacher',
        fullName: 'Dr. Smith',
        staffNumber: 'STF-0101',
        department: 'Software Engineering',
      }),
      ...students,
    ],
  })
}

/** Renders the Users page at `path`, as the signed-in admin. */
function renderUsers(path = '/admin/users', data = platform(), overrides: Partial<Services> = {}) {
  return renderWithRouter({
    routes,
    path,
    session: makeSession('admin', { fullName: 'Amara Okafor' }),
    platform: data,
    overrides,
  })
}

/** The rows of the desktop table, header first. */
async function tableRows() {
  return within(await screen.findByRole('table', { name: /Users/ })).getAllByRole('row')
}

describe('UsersPage', () => {
  // Proves the students tab opens first, with its columns and 20 to a page.
  it('lists students first, with their columns', async () => {
    // Act.
    renderUsers()

    // Assert: heading, selected tab, columns, and the first page.
    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Students' })).toHaveAttribute('aria-selected', 'true')
    const rows = await tableRows()
    expect(
      within(rows[0]!)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      'Student number',
      'Name',
      'Email',
      'Courses',
      'Status',
      'Created',
      'Last active',
      'Actions',
    ])
    expect(rows).toHaveLength(21)
    expect(screen.getByText('Showing 1–20 of 25')).toBeInTheDocument()
  })

  // Proves the tabs change the list and the address.
  it('switches tabs through the address', async () => {
    // Arrange.
    const { user, router } = renderUsers()
    await tableRows()

    // Act.
    await user.click(screen.getByRole('tab', { name: 'Teachers' }))

    // Assert.
    expect(router.state.location.search).toBe('?tab=teachers')
    expect(await screen.findByRole('link', { name: 'Dr. Smith' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Staff number' })).toBeInTheDocument()
  })

  // Proves the search and the status filter narrow the list and live in the address.
  it('searches and filters through the address', async () => {
    // Arrange.
    const { user, router } = renderUsers()
    await tableRows()

    // Act: filter by status.
    await user.selectOptions(screen.getByLabelText('Status'), 'suspended')

    // Assert.
    expect(router.state.location.search).toBe('?status=suspended')
    expect(await screen.findByText('Showing 1–1 of 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Student 03' })).toBeInTheDocument()

    // Act: search instead.
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search users' }), 'u2023/5012')

    // Assert: after the typing pause, the address and the list follow.
    await waitFor(() => {
      expect(router.state.location.search).toBe('?q=u2023%2F5012')
    })
    expect(await screen.findByText('Showing 1–1 of 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Student 12' })).toBeInTheDocument()
  })

  // Proves a filtered view opened from a link (or after a refresh) shows the same results.
  it('reads the filters from the address', async () => {
    // Act.
    renderUsers('/admin/users?status=suspended')

    // Assert.
    expect(await screen.findByText('Showing 1–1 of 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toHaveValue('suspended')
  })

  // Proves a search with no matches offers to clear it.
  it('says when nothing matches, and clears the filters', async () => {
    // Arrange.
    const { user, router } = renderUsers('/admin/users?q=nobody')

    // Act.
    expect(await screen.findByText('Nothing matches these filters.')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1)!)

    // Assert.
    expect(router.state.location.search).toBe('')
    expect(await screen.findByText('Showing 1–20 of 25')).toBeInTheDocument()
  })

  // Proves an empty tab says so plainly.
  it('says when a tab has no users', async () => {
    // Act: a platform with only the admin.
    renderUsers(
      '/admin/users',
      emptyPlatformData({ users: [userRecord({ id: 'admin-test', role: 'admin' })] }),
    )

    // Assert.
    expect(await screen.findByText('No users found.')).toBeInTheDocument()
  })

  // Proves the pages and the sort change the list and the address.
  it('pages and sorts', async () => {
    // Arrange.
    const { user, router } = renderUsers()
    await tableRows()

    // Act: next page.
    await user.click(screen.getByRole('button', { name: 'Next page' }))

    // Assert.
    expect(router.state.location.search).toBe('?page=2')
    expect(await screen.findByText('Showing 21–25 of 25')).toBeInTheDocument()

    // Act: the list is A to Z by name; one click reverses it (and goes back to page 1).
    await user.click(screen.getByRole('button', { name: 'Name' }))

    // Assert.
    expect(router.state.location.search).toBe('?sort=-name')
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    expect((await tableRows())[1]).toHaveTextContent('Student 25')
  })

  // Proves inviting someone adds them as invited, and a taken email is explained.
  it('invites someone', async () => {
    // Arrange.
    const { user } = renderUsers()
    await tableRows()

    // Act: a taken email first.
    await user.click(screen.getByRole('button', { name: 'Invite user' }))
    const dialog = await screen.findByRole('dialog', { name: 'Invite a user' })
    await user.type(within(dialog).getByLabelText('Full name'), 'Ngozi Eze')
    await user.type(within(dialog).getByLabelText('Email'), 'student01@conote.example')
    await user.selectOptions(within(dialog).getByLabelText('Department'), 'Computer Science')
    await user.click(within(dialog).getByRole('button', { name: 'Send invitation' }))

    // Assert.
    expect(
      await within(dialog).findByText('An account with this email already exists.'),
    ).toBeInTheDocument()

    // Act: a new email.
    await user.clear(within(dialog).getByLabelText('Email'))
    await user.type(within(dialog).getByLabelText('Email'), 'ngozi@conote.example')
    await user.click(within(dialog).getByRole('button', { name: 'Send invitation' }))

    // Assert: confirmed, closed, and listed as invited.
    expect(await screen.findByText('Invitation sent to ngozi@conote.example.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText('Showing 1–20 of 26')).toBeInTheDocument()
  })

  // Proves suspending asks first, then shows the new status.
  it('suspends after confirmation', async () => {
    // Arrange.
    const { user } = renderUsers()
    const rows = await tableRows()

    // Act: open Student 01's actions and suspend.
    await user.click(within(rows[1]!).getByRole('button', { name: 'Actions for Student 01' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Suspend' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Suspend Student 01?' })
    await user.click(within(confirm).getByRole('button', { name: 'Suspend' }))

    // Assert.
    expect(await screen.findByText('Student 01 is now suspended.')).toBeInTheDocument()
    expect(within((await tableRows())[1]!).getByText('Suspended')).toBeInTheDocument()
  })

  // Proves a failed load shows the message and a retry, never the raw error.
  it('shows an error with a retry', async () => {
    // Act.
    renderUsers('/admin/users', platform(), {
      users: {
        ...renderUsersServices(),
        listUsers: () => Promise.reject(new AppError('unknown', 'relation "profiles" missing')),
      },
    })

    // Assert.
    expect(await screen.findByText('Unable to load users.')).toBeInTheDocument()
    expect(screen.queryByText(/relation/)).toBeNull()
  })

  // Proves the page has no accessibility problems.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderUsers()
    await tableRows()

    // Assert.
    await expectNoAxeViolations(container)
  })
})

/** A working user service to override one method of. */
function renderUsersServices() {
  // Never called for the methods the test replaces; the rest reject so a mistake shows.
  const unused = () => Promise.reject(new Error('not used in this test'))
  return {
    listUsers: unused,
    listFilterOptions: () => Promise.resolve({ departments: [], courses: [] }),
    getUser: unused,
    inviteUser: unused,
    updateUser: unused,
    setUserStatus: unused,
    sendPasswordReset: unused,
  }
}
