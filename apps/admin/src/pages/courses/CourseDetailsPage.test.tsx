/**
 * Tests for the course details page (admin REQUIREMENTS section 12): the four tabs, editing,
 * archiving, the teacher, the students, and bulk enrolment with its preview.
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The routes, so the page renders inside the real layout.
import { routes } from '@/app/routes'
// The records the demo services read.
import {
  courseRecord,
  emptyPlatformData,
  userRecord,
  type PlatformData,
  classRecord,
  enrollmentRequestRecord,
} from '@/services/platformData'
// Session builder.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** A student with predictable details. */
function student(n: number, overrides = {}) {
  const id = `s${String(n)}`
  return userRecord({
    id,
    role: 'student',
    fullName: `Student ${String(n)}`,
    email: `student${String(n)}@conote.example`,
    studentNumber: `U2023/500${String(n)}`,
    ...overrides,
  })
}

/** The platform: CSC 101 (taught, 2 students, classes, resources), SWE 311 (no teacher), OLD 100. */
function platform(): PlatformData {
  return emptyPlatformData({
    users: [
      userRecord({ id: 'admin-test', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({ id: 't1', role: 'teacher', fullName: 'Dr. Smith' }),
      userRecord({ id: 't2', role: 'teacher', fullName: 'Mrs. Okoro' }),
      userRecord({ id: 't3', role: 'teacher', fullName: 'Mr. Away', status: 'inactive' }),
      student(1),
      student(2),
      student(3, { status: 'suspended' }),
      student(4),
    ],
    courses: [
      courseRecord({
        id: 'c1',
        code: 'CSC 101',
        title: 'Programming',
        description: 'Learn to program.',
        department: 'Computing',
        teacherId: 't1',
      }),
      courseRecord({ id: 'c2', code: 'SWE 311', title: 'Software Engineering' }),
      courseRecord({
        id: 'c3',
        code: 'OLD 100',
        title: 'Old course',
        teacherId: 't1',
        archivedAt: '2026-09-01T09:00:00.000Z',
      }),
    ],
    enrollments: [
      { courseId: 'c1', studentId: 's1' },
      { courseId: 'c1', studentId: 's2' },
      { courseId: 'c3', studentId: 's1' },
    ],
    classes: [
      classRecord({
        id: 'cl1',
        courseId: 'c1',
        title: 'Variables',
        startsAt: '2026-09-10T09:00:00.000Z',
        archivedAt: null,
      }),
      classRecord({
        id: 'cl2',
        courseId: 'c1',
        title: 'Loops',
        startsAt: '2026-09-17T09:00:00.000Z',
        archivedAt: null,
      }),
    ],
    summaries: [
      {
        id: 'sm1',
        classId: 'cl1',
        status: 'published',
        inReviewSince: null,
        publishedAt: '2026-09-12T09:00:00.000Z',
      },
      {
        id: 'sm2',
        classId: 'cl2',
        status: 'in_review',
        inReviewSince: '2026-09-18T09:00:00.000Z',
        publishedAt: null,
      },
    ],
    enrollmentRequests: [enrollmentRequestRecord({ id: 'q1', courseId: 'c1', studentId: 's4' })],
    resources: [
      {
        id: 'r1',
        title: 'Course outline',
        type: 'pdf',
        courseId: 'c1',
        classId: null,
        status: 'published',
        createdAt: '2026-09-01T09:00:00.000Z',
      },
      {
        id: 'r2',
        title: 'Week 1 slides',
        type: 'slides',
        courseId: 'c1',
        classId: 'cl1',
        status: 'draft',
        createdAt: '2026-09-02T09:00:00.000Z',
      },
    ],
  })
}

/** Renders the details page for `courseId`, as the signed-in admin. */
function renderCourse(courseId = 'c1') {
  return renderWithRouter({
    routes,
    path: `/admin/courses/${courseId}`,
    session: makeSession('admin', { fullName: 'Amara Okafor' }),
    platform: platform(),
  })
}

/** Opens the tab named `name`. */
async function openTab(user: ReturnType<typeof renderCourse>['user'], name: string) {
  await user.click(await screen.findByRole('tab', { name }))
}

describe('CourseDetailsPage', () => {
  // Proves the overview shows the facts the spec lists.
  it('shows the overview', async () => {
    renderCourse()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'CSC 101 · Programming' }),
    ).toBeInTheDocument()
    const overview = screen.getByRole('tabpanel', { name: 'Overview' })
    expect(within(overview).getByText('Learn to program.')).toBeInTheDocument()
    expect(within(overview).getByText('Dr. Smith')).toBeInTheDocument()
    expect(within(overview).getByText('Ongoing')).toBeInTheDocument()
    // Students 2, classes 2, published summaries 1, resources 2.
    const figure = (term: string) =>
      within(overview).getByText(term).nextElementSibling?.textContent
    expect(figure('Students')).toBe('2')
    expect(figure('Classes')).toBe('2')
    expect(figure('Published summaries')).toBe('1')
    expect(figure('Resources')).toBe('2')
  })

  // Proves an unknown course gets its own message and the way back.
  it('shows a not-found message', async () => {
    renderCourse('nope')
    expect(await screen.findByRole('heading', { name: 'Course not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Courses' })).toHaveAttribute(
      'href',
      '/admin/courses',
    )
  })

  // Proves the classes tab shows each class with its summary stage.
  it('lists the classes with their summary status', async () => {
    const { user } = renderCourse()
    await openTab(user, 'Classes')

    const panel = await screen.findByRole('tabpanel', { name: 'Classes' })
    const items = within(panel).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Variables')
    expect(items[0]).toHaveTextContent('Published')
    expect(items[1]).toHaveTextContent('Loops')
    expect(items[1]).toHaveTextContent('In review')
  })

  // Proves the resources tab lists this course's resources, and says so when it has none.
  it('lists the resources', async () => {
    const { user } = renderCourse()
    await openTab(user, 'Resources')
    const panel = await screen.findByRole('tabpanel', { name: 'Resources' })
    expect(within(panel).getByText('Course outline')).toBeInTheDocument()
    expect(within(panel).getByText('Week 1 slides')).toBeInTheDocument()
    expect(within(panel).getByText('Variables')).toBeInTheDocument()
  })

  // Proves empty tabs explain themselves.
  it('shows empty messages for a course with nothing in it', async () => {
    const { user } = renderCourse('c2')
    await openTab(user, 'Classes')
    expect(
      await screen.findByText('No classes have been added to this course.'),
    ).toBeInTheDocument()
    await openTab(user, 'Resources')
    expect(await screen.findByText('No resources have been added.')).toBeInTheDocument()
    await openTab(user, 'Students')
    expect(await screen.findByText('No students are enrolled yet.')).toBeInTheDocument()
  })

  // Proves the students tab lists and searches.
  it('lists and searches the students', async () => {
    const { user } = renderCourse()
    await openTab(user, 'Students')

    const table = await screen.findByRole('table', { name: 'Students in CSC 101' })
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    await user.type(screen.getByRole('searchbox', { name: 'Search students' }), 'student2')
    await waitFor(() => {
      expect(
        within(screen.getByRole('table', { name: 'Students in CSC 101' })).getAllByRole('row'),
      ).toHaveLength(2)
    })
    await user.clear(screen.getByRole('searchbox', { name: 'Search students' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search students' }), 'zzz')
    expect(await screen.findByText('No students match this search.')).toBeInTheDocument()
  })

  // Proves editing saves and the heading follows.
  it('edits the course', async () => {
    const { user } = renderCourse()
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: /Edit CSC 101/ })
    await user.clear(within(dialog).getByLabelText('Title'))
    await user.type(within(dialog).getByLabelText('Title'), 'Programming II')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'CSC 101 · Programming II' }),
    ).toBeInTheDocument()
  })

  // Proves archiving asks first, then locks the page; restoring unlocks it.
  it('archives and restores', async () => {
    const { user } = renderCourse()
    await user.click(await screen.findByRole('button', { name: 'Archive' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Archive CSC 101?' })
    await user.click(within(confirm).getByRole('button', { name: 'Archive' }))

    expect(
      await screen.findByText('This course is archived. Restore it to make changes.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change teacher' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Restore' }))
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(
      screen.queryByText('This course is archived. Restore it to make changes.'),
    ).not.toBeInTheDocument()
  })

  // Proves an archived course offers no changes to its teacher or students.
  it('offers no changes on an archived course', async () => {
    const { user } = renderCourse('c3')
    expect(
      await screen.findByText('This course is archived. Restore it to make changes.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument()
    await openTab(user, 'Students')
    await screen.findByRole('table', { name: 'Students in OLD 100' })
    expect(screen.queryByRole('button', { name: 'Enrol students' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument()
  })

  // Proves a teacher can be assigned, changed, and removed after confirming.
  it('assigns, changes and removes the teacher', async () => {
    const { user } = renderCourse('c2')

    // Assign: only active teachers are offered.
    await user.click(await screen.findByRole('button', { name: 'Assign teacher' }))
    let dialog = await screen.findByRole('dialog', { name: 'Assign a teacher' })
    const select = within(dialog).getByLabelText('Teacher')
    expect(within(select).queryByRole('option', { name: 'Mr. Away' })).not.toBeInTheDocument()
    await user.selectOptions(select, 'Dr. Smith')
    await user.click(within(dialog).getByRole('button', { name: 'Assign teacher' }))
    expect(await screen.findByText('Dr. Smith')).toBeInTheDocument()

    // Change.
    await user.click(screen.getByRole('button', { name: 'Change teacher' }))
    dialog = await screen.findByRole('dialog', { name: 'Change the teacher' })
    await user.selectOptions(within(dialog).getByLabelText('Teacher'), 'Mrs. Okoro')
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }))
    expect(await screen.findByText('Mrs. Okoro')).toBeInTheDocument()

    // Remove: asks first, then leaves the course without a teacher.
    await user.click(screen.getByRole('button', { name: 'Remove teacher' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Remove Mrs. Okoro?' })
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }))
    expect(await screen.findByText('No teacher assigned.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Assign teacher' })).toBeInTheDocument()
  })

  // Proves removing a student asks first and updates the list.
  it('removes a student after confirmation', async () => {
    const { user } = renderCourse()
    await openTab(user, 'Students')
    await screen.findByRole('table', { name: 'Students in CSC 101' })

    await user.click(screen.getByRole('button', { name: 'Remove Student 2' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Remove Student 2?' })
    expect(confirm).toHaveTextContent('CSC 101')
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(screen.queryByText('Student 2')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Student 1')).toBeInTheDocument()
  })

  // Proves pasted text is previewed, and only the valid rows are enrolled.
  it('previews pasted identifiers and enrols only the valid rows', async () => {
    const { user } = renderCourse()
    await openTab(user, 'Students')
    await screen.findByRole('table', { name: 'Students in CSC 101' })

    await user.click(screen.getByRole('button', { name: 'Enrol students' }))
    const dialog = await screen.findByRole('dialog', { name: 'Enrol students' })
    await user.type(
      within(dialog).getByLabelText('Emails or student numbers'),
      // New, new by number, already in, suspended, a teacher, unknown.
      'student4@conote.example\nU2023/5004\nstudent1@conote.example\nstudent3@conote.example\nt1@conote.example\nghost@conote.example',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Preview' }))

    // The preview: one to enrol, one already in, three that don't match, with reasons.
    expect(await within(dialog).findByText('Will be enrolled (1)')).toBeInTheDocument()
    expect(within(dialog).getByText('Already enrolled (1)')).toBeInTheDocument()
    expect(within(dialog).getByText('Not matched (3)')).toBeInTheDocument()
    expect(within(dialog).getByText(/^student3@conote\.example — /)).toHaveTextContent('Not active')
    expect(within(dialog).getByText(/^t1@conote\.example — /)).toHaveTextContent('Not a student')
    expect(within(dialog).getByText(/^ghost@conote\.example — /)).toHaveTextContent(
      'No account found',
    )
    // Nothing has been enrolled yet.
    const table = screen.getByRole('table', { name: 'Students in CSC 101', hidden: true })
    expect(within(table).queryByText('Student 4')).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Enrol 1 student' }))

    expect(await screen.findByText('Enrolled 1 student.')).toBeInTheDocument()
    expect(
      await within(screen.getByRole('table', { name: 'Students in CSC 101' })).findByText(
        'Student 4',
      ),
    ).toBeInTheDocument()
  })

  // Proves a .csv file is read like pasted text.
  it('reads a CSV file', async () => {
    const { user } = renderCourse()
    await openTab(user, 'Students')
    await screen.findByRole('table', { name: 'Students in CSC 101' })
    await user.click(screen.getByRole('button', { name: 'Enrol students' }))
    const dialog = await screen.findByRole('dialog', { name: 'Enrol students' })

    const file = new File(['email\nstudent4@conote.example\n'], 'class.csv', { type: 'text/csv' })
    await user.upload(within(dialog).getByLabelText('Or upload a .csv file'), file)
    await user.click(within(dialog).getByRole('button', { name: 'Preview' }))

    expect(await within(dialog).findByText('Will be enrolled (1)')).toBeInTheDocument()
  })

  // Proves an empty paste is explained instead of previewed.
  it('asks for at least one value', async () => {
    const { user } = renderCourse()
    await openTab(user, 'Students')
    await screen.findByRole('table', { name: 'Students in CSC 101' })
    await user.click(screen.getByRole('button', { name: 'Enrol students' }))
    const dialog = await screen.findByRole('dialog', { name: 'Enrol students' })

    await user.click(within(dialog).getByRole('button', { name: 'Preview' }))

    expect(
      await within(dialog).findByText('Enter at least one email or student number.'),
    ).toBeInTheDocument()
  })

  // Proves nothing valid means nothing to apply.
  it('disables enrolment when no row can be added', async () => {
    const { user } = renderCourse()
    await openTab(user, 'Students')
    await screen.findByRole('table', { name: 'Students in CSC 101' })
    await user.click(screen.getByRole('button', { name: 'Enrol students' }))
    const dialog = await screen.findByRole('dialog', { name: 'Enrol students' })
    await user.type(
      within(dialog).getByLabelText('Emails or student numbers'),
      'ghost@conote.example',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Preview' }))

    expect(await within(dialog).findByRole('button', { name: 'Enrol 0 students' })).toBeDisabled()
  })

  // Proves the page has no accessibility violations on the overview and the students tab.
  it('has no accessibility violations', async () => {
    const { container, user } = renderCourse()
    await screen.findByRole('heading', { level: 1, name: 'CSC 101 · Programming' })
    await expectNoAxeViolations(container)
    await openTab(user, 'Students')
    await screen.findByRole('table', { name: 'Students in CSC 101' })
    await expectNoAxeViolations(container)
  })

  // Proves the Requests tab lists who is waiting, and the tab title counts them.
  it('lists the students waiting to join', async () => {
    const { user } = renderCourse()
    await openTab(user, 'Requests (1)')

    const table = await screen.findByRole('table', { name: 'Requests to join CSC 101' })
    expect(within(table).getByText('Student 4')).toBeInTheDocument()
    expect(within(table).getByText('student4@conote.example')).toBeInTheDocument()
  })

  // Proves approving enrols the student and the request leaves the list.
  it('approves a request and enrols the student', async () => {
    const { user } = renderCourse()
    await openTab(user, 'Requests (1)')
    await user.click(await screen.findByRole('button', { name: 'Approve Student 4' }))

    expect(await screen.findByText('No students are waiting to join.')).toBeInTheDocument()
    expect(await screen.findByText('Student 4 added to CSC 101.')).toBeInTheDocument()
    await openTab(user, 'Students')
    expect(await screen.findByText('Student 4')).toBeInTheDocument()
  })

  // Proves declining removes the request without enrolling.
  it('declines a request', async () => {
    const { user } = renderCourse()
    await openTab(user, 'Requests (1)')
    await user.click(await screen.findByRole('button', { name: 'Decline Student 4' }))

    expect(await screen.findByText('No students are waiting to join.')).toBeInTheDocument()
    await openTab(user, 'Students')
    await screen.findByText('Student 1')
    expect(screen.queryByText('Student 4')).not.toBeInTheDocument()
  })

  // Proves an archived course shows requests but offers no decision.
  it('offers no decision on an archived course', async () => {
    const { user } = renderCourse('c3')
    await openTab(user, 'Requests')
    expect(await screen.findByText('No students are waiting to join.')).toBeInTheDocument()
  })
})
