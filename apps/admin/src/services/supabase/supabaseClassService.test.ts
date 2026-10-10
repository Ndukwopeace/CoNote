/**
 * Tests for the Supabase class service's own logic, against a fake client: which queries it makes,
 * how it keeps a search from adding conditions, and how it words each refusal. The real database
 * is covered by the integration contract run (supabaseClassService.integration.test.ts).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The fake client, and the helper that asks what a query did.
import {
  createFakeTables,
  made,
  type RecordedQuery,
  type TableAnswer,
} from '@conote/testing/fakeTables'

// Local dates and times, as the form gives them.
import { toIso } from '@/lib/classTimes'

// The service under test.
import { createSupabaseClassService } from './supabaseClassService'

// IDs the tests use.
const ADMIN = '10000000-0000-4000-8000-000000000001'
const COURSE = '20000000-0000-4000-8000-000000000001'
const CLASS = '40000000-0000-4000-8000-000000000001'
const TEACHER = '10000000-0000-4000-8000-000000000002'

/** A class as the list view returns it. */
function classRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CLASS,
    number: 3,
    course_id: COURSE,
    course_code: 'MTH 202',
    course_title: 'Linear Algebra',
    title: 'Vectors',
    description: '',
    starts_at: '2026-09-10T09:00:00+00:00',
    ends_at: '2026-09-10T10:30:00+00:00',
    archived_at: null,
    teacher_id: TEACHER,
    teacher_name: 'Dr. Smith',
    summary_status: 'published',
    in_review_since: '2026-09-10T13:00:00+00:00',
    published_at: '2026-09-11T09:00:00+00:00',
    note_count: 14,
    student_count: 2,
    ...overrides,
  }
}

/** A refused call, as PostgREST reports it. */
const refusal = (code: string) => ({ data: null, error: { code, message: 'raw' } })

/** A service whose queries are answered by `answer`. */
function setup(answer: (query: RecordedQuery) => TableAnswer) {
  const { client, queries } = createFakeTables(answer, { userId: ADMIN })
  const now = () => new Date('2026-10-08T12:00:00.000Z')
  return { service: createSupabaseClassService({ client, now }), queries }
}

/** The valid class form the tests send. */
const FORM = {
  courseId: COURSE,
  title: ' Recursion ',
  date: '2026-10-20',
  startTime: '09:00',
  endTime: '10:30',
  description: '',
}

describe('listClasses', () => {
  // Proves the list counts first, then reads one page, newest first with the tie-breaks.
  it('counts, then reads one page in order', async () => {
    const { service, queries } = setup((query) =>
      made(query, 'select', 'id', { count: 'exact', head: true })
        ? { data: null, error: null, count: 45 }
        : { data: [classRow()], error: null },
    )
    const page = await service.listClasses({ page: 2 })
    expect(page).toMatchObject({ total: 45, page: 2, pageSize: 20 })
    expect(page.items[0]).toMatchObject({
      number: 3,
      courseCode: 'MTH 202',
      teacher: { id: TEACHER, fullName: 'Dr. Smith' },
      summaryStatus: 'published',
      noteCount: 14,
      // Times come back as ISO text with a "Z".
      startsAt: '2026-09-10T09:00:00.000Z',
    })
    const read = queries[1]!
    expect(made(read, 'order', 'starts_at', { ascending: false })).toBe(true)
    expect(made(read, 'order', 'course_code')).toBe(true)
    expect(made(read, 'order', 'number')).toBe(true)
    expect(made(read, 'range', 20, 39)).toBe(true)
  })

  // Proves a page past the end shows the last page, and an empty list makes no second request.
  it('shows the last page, and reads nothing when nothing matches', async () => {
    const { service, queries } = setup((query) =>
      made(query, 'select', 'id', { count: 'exact', head: true })
        ? { data: null, error: null, count: 23 }
        : { data: [classRow()], error: null },
    )
    expect((await service.listClasses({ page: 9 })).page).toBe(2)
    const empty = setup(() => ({ data: null, error: null, count: 0 }))
    await expect(empty.service.listClasses({})).resolves.toMatchObject({ items: [], total: 0 })
    expect(empty.queries).toHaveLength(1)
    expect(queries).toHaveLength(2)
  })

  // Proves each sort orders by the right column.
  it.each([
    ['course', 'course_code', true],
    ['-course', 'course_code', false],
    ['title', 'title', true],
    ['-date', 'starts_at', false],
  ] as const)('sorts by %s', async (sort, column, ascending) => {
    const { service, queries } = setup((query) =>
      made(query, 'select', 'id', { count: 'exact', head: true })
        ? { data: null, error: null, count: 1 }
        : { data: [classRow()], error: null },
    )
    await service.listClasses({ sort })
    expect(made(queries[1]!, 'order', column, { ascending })).toBe(true)
  })

  // Proves the filters become the matching conditions.
  it('filters by course, stage, dates and archive state', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null, count: 0 }))
    await service.listClasses({
      courseId: COURSE,
      summaryStatus: 'in_review',
      from: '2026-09-04',
      to: '2026-09-05',
      archived: true,
    })
    const query = queries[0]!
    expect(made(query, 'not', 'archived_at', 'is', null)).toBe(true)
    expect(made(query, 'eq', 'course_id', COURSE)).toBe(true)
    expect(made(query, 'eq', 'summary_status', 'in_review')).toBe(true)
    // Both ends are included: from the start of the first day to the start of the day after the last.
    expect(made(query, 'gte', 'starts_at', toIso('2026-09-04', '00:00'))).toBe(true)
    expect(made(query, 'lt', 'starts_at', new Date(2026, 8, 6).toISOString())).toBe(true)
  })

  // Proves "none" and "processing" read the stage column the way students see stages.
  it('filters classes without a summary, and counts a failed run as processing', async () => {
    const none = setup(() => ({ data: null, error: null, count: 0 }))
    await none.service.listClasses({ summaryStatus: 'none' })
    expect(made(none.queries[0]!, 'is', 'summary_status', null)).toBe(true)
    const processing = setup(() => ({ data: null, error: null, count: 0 }))
    await processing.service.listClasses({ summaryStatus: 'processing' })
    expect(made(processing.queries[0]!, 'in', 'summary_status', ['processing', 'failed'])).toBe(
      true,
    )
  })

  // SECURITY: proves a search cannot add conditions of its own to the filter.
  it('keeps filter characters in a search out of the query', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null, count: 0 }))
    await service.listClasses({ q: 'x),archived_at.is.null,(' })
    const search = queries[0]!.calls.find((call) => call[0] === 'or')
    expect(search?.[1]).toBe(
      'title.ilike.%x  archived at.is.null%,course_code.ilike.%x  archived at.is.null%',
    )
  })

  // SECURITY: proves a course ID that is not a UUID matches nothing and never reaches a query.
  it('matches nothing for a course ID that is not a UUID', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null, count: 5 }))
    await expect(service.listClasses({ courseId: 'nope' })).resolves.toMatchObject({ total: 0 })
    expect(queries).toHaveLength(0)
  })

  // Proves a refused read becomes an AppError.
  it('reports a refused read', async () => {
    const { service } = setup(() => refusal('42501'))
    await expect(service.listClasses({})).rejects.toMatchObject({ kind: 'forbidden' })
  })
})

describe('listClassFilterOptions', () => {
  // Proves every course is offered by code, saying which are archived.
  it('lists the courses by code', async () => {
    const { service } = setup(() => ({
      data: [
        { id: 'b', code: 'PHY 101', title: 'Physics', archived_at: '2026-09-01T09:00:00+00:00' },
        { id: 'a', code: 'MTH 202', title: 'Linear Algebra', archived_at: null },
      ],
      error: null,
    }))
    const { courses } = await service.listClassFilterOptions()
    expect(courses.map((course) => [course.code, course.archived])).toEqual([
      ['MTH 202', false],
      ['PHY 101', true],
    ])
  })
})

describe('getClass', () => {
  // SECURITY: proves an ID that is not a UUID never reaches a query.
  it('does not query for an ID that is not a UUID', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null }))
    await expect(service.getClass('nope')).rejects.toMatchObject({ kind: 'not_found' })
    expect(queries).toHaveLength(0)
  })

  // Proves an unknown class is not found.
  it('rejects an unknown class', async () => {
    const { service } = setup(() => ({ data: null, error: null }))
    await expect(service.getClass(CLASS)).rejects.toMatchObject({
      kind: 'not_found',
      message: 'Class not found.',
    })
  })

  // Proves the details carry the job history and a timeline built from the recorded times.
  it('returns the jobs and the summary timeline', async () => {
    const { service } = setup((query) =>
      query.table === 'admin_classes'
        ? { data: classRow(), error: null }
        : {
            data: [
              {
                id: 'j1',
                status: 'failed',
                attempt: 1,
                created_at: '2026-09-10T11:30:00+00:00',
                finished_at: null,
              },
              {
                id: 'j2',
                status: 'succeeded',
                attempt: 2,
                created_at: '2026-09-10T12:30:00+00:00',
                finished_at: '2026-09-10T13:00:00+00:00',
              },
            ],
            error: null,
          },
    )
    const details = await service.getClass(CLASS)
    expect(details).toMatchObject({ studentCount: 2, description: '' })
    expect(details.aiJobs.map((job) => [job.id, job.status, job.finishedAt])).toEqual([
      ['j1', 'failed', null],
      ['j2', 'succeeded', '2026-09-10T13:00:00.000Z'],
    ])
    expect(details.timeline).toEqual([
      { stage: 'collecting', at: '2026-09-10T09:00:00.000Z', reached: true },
      { stage: 'processing', at: '2026-09-10T11:30:00.000Z', reached: true },
      { stage: 'in_review', at: '2026-09-10T13:00:00.000Z', reached: true },
      { stage: 'published', at: '2026-09-11T09:00:00.000Z', reached: true },
    ])
  })

  // Proves a class with no summary has reached nothing, and a failed run shows as processing.
  it('shows no stage before a summary, and a failed run as processing', async () => {
    const none = setup((query) =>
      query.table === 'admin_classes'
        ? { data: classRow({ summary_status: null, published_at: null }), error: null }
        : { data: [], error: null },
    )
    expect((await none.service.getClass(CLASS)).timeline.every((step) => !step.reached)).toBe(true)
    const failed = setup((query) =>
      query.table === 'admin_classes'
        ? { data: classRow({ summary_status: 'failed' }), error: null }
        : { data: [], error: null },
    )
    const details = await failed.service.getClass(CLASS)
    expect(details.summaryStatus).toBe('processing')
    expect(details.timeline.map((step) => step.reached)).toEqual([true, true, false, false])
  })
})

describe('createClass', () => {
  /** A service whose course is `course` (null: it does not exist). */
  function over(course: Record<string, unknown> | null) {
    return setup((query) => {
      if (query.table === 'admin_courses') return { data: course, error: null }
      if (query.table === 'class_sessions') return { data: { id: CLASS }, error: null }
      if (query.table === 'admin_classes') return { data: classRow(), error: null }
      return { data: [], error: null }
    })
  }

  // Proves the form rules run in the service, before any request.
  it('validates before writing', async () => {
    const { service, queries } = over({ id: COURSE, archived_at: null })
    await expect(service.createClass({ ...FORM, title: ' ' })).rejects.toMatchObject({
      message: 'Enter a title.',
    })
    await expect(service.createClass({ ...FORM, endTime: '09:00' })).rejects.toMatchObject({
      message: 'The end time must be after the start time.',
    })
    expect(queries).toHaveLength(0)
  })

  // Proves a class is added to a course in use, with the times as instants and no number sent.
  it('adds the class and leaves the number to the database', async () => {
    const { service, queries } = over({ id: COURSE, archived_at: null })
    await service.createClass(FORM)
    const insert = queries
      .find((query) => query.table === 'class_sessions')!
      .calls.find((call) => call[0] === 'insert')
    expect(insert?.[1]).toEqual({
      course_id: COURSE,
      title: 'Recursion',
      description: '',
      starts_at: toIso('2026-10-20', '09:00'),
      ends_at: toIso('2026-10-20', '10:30'),
    })
  })

  // Proves a missing, mistyped or archived course is refused with the form's messages.
  it('refuses a missing or archived course', async () => {
    await expect(over(null).service.createClass(FORM)).rejects.toMatchObject({
      message: 'Choose a course.',
    })
    await expect(
      over({ id: COURSE, archived_at: 'x' }).service.createClass(FORM),
    ).rejects.toMatchObject({ message: 'This course is archived. Restore it to make changes.' })
    const { service, queries } = over(null)
    await expect(service.createClass({ ...FORM, courseId: 'ghost' })).rejects.toMatchObject({
      message: 'Choose a course.',
    })
    expect(queries).toHaveLength(0)
  })

  // Proves a refused write is reported.
  it('reports a refused write', async () => {
    const { service } = setup((query) =>
      query.table === 'admin_courses'
        ? { data: { id: COURSE, archived_at: null }, error: null }
        : refusal('42501'),
    )
    await expect(service.createClass(FORM)).rejects.toMatchObject({ kind: 'forbidden' })
  })
})

describe('updateClass and archiveClass', () => {
  /** A service over a class that is archived or not. */
  function over(archivedAt: string | null) {
    return setup((query) =>
      query.table === 'admin_classes'
        ? { data: classRow({ archived_at: archivedAt }), error: null }
        : { data: [], error: null },
    )
  }

  // Proves editing changes the fields and keeps the course.
  it('updates the title and times', async () => {
    const { service, queries } = over(null)
    await service.updateClass(CLASS, FORM)
    const update = queries.find((query) => query.table === 'class_sessions')!
    expect(
      made(update, 'update', {
        title: 'Recursion',
        description: '',
        starts_at: toIso('2026-10-20', '09:00'),
        ends_at: toIso('2026-10-20', '10:30'),
      }),
    ).toBe(true)
    expect(made(update, 'eq', 'id', CLASS)).toBe(true)
  })

  // Proves a class cannot move to another course, and an archived one refuses every change.
  it('refuses a move, and changes to an archived class', async () => {
    await expect(
      over(null).service.updateClass(CLASS, {
        ...FORM,
        courseId: '20000000-0000-4000-8000-000000000009',
      }),
    ).rejects.toMatchObject({ message: 'A class can’t move to another course.' })
    await expect(over('x').service.updateClass(CLASS, FORM)).rejects.toMatchObject({
      message: 'This class is archived. It can’t be changed.',
    })
    await expect(over('x').service.archiveClass(CLASS)).rejects.toMatchObject({
      message: 'This class is already archived.',
    })
  })

  // Proves archiving stamps the time from the clock.
  it('archives with the clock’s time', async () => {
    const { service, queries } = over(null)
    await service.archiveClass(CLASS)
    const update = queries.find((query) => query.table === 'class_sessions')!
    expect(made(update, 'update', { archived_at: '2026-10-08T12:00:00.000Z' })).toBe(true)
  })

  // SECURITY: proves no change is attempted without a session.
  it('refuses every change when nobody is signed in', async () => {
    const { client, queries } = createFakeTables(() => ({ data: null, error: null }))
    const service = createSupabaseClassService({ client })
    await expect(service.createClass(FORM)).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(service.updateClass(CLASS, FORM)).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(service.archiveClass(CLASS)).rejects.toMatchObject({ kind: 'unauthorized' })
    expect(queries).toHaveLength(0)
  })

  // Proves an unknown class is not found.
  it('rejects an unknown class', async () => {
    const { service } = setup(() => ({ data: null, error: null }))
    await expect(service.updateClass(CLASS, FORM)).rejects.toMatchObject({ kind: 'not_found' })
    await expect(service.archiveClass('nope')).rejects.toMatchObject({ kind: 'not_found' })
  })
})
