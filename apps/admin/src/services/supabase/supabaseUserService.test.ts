/**
 * Tests for the Supabase user service's own logic, against a fake client: which queries it makes,
 * how it reads the history, and how it calls the Edge Functions. The real database and the
 * functions' handlers are covered by the integration contract run
 * (supabaseUserService.integration.test.ts).
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The fake client, and the helper that asks what a query did.
import {
  createFakeTables,
  made,
  type RecordedQuery,
  type TableAnswer,
} from '@conote/testing/fakeTables'

// The service under test.
import type { FunctionResult } from './functionCall'
import { createSupabaseUserService } from './supabaseUserService'

// IDs the tests use.
const ADMIN = '10000000-0000-4000-8000-000000000001'
const USER = '10000000-0000-4000-8000-000000000002'
const COURSE = '20000000-0000-4000-8000-000000000001'

/** An account as the list view returns it. */
function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: USER,
    role: 'student',
    status: 'active',
    full_name: 'Ada Eze',
    email: 'ada@conote.example',
    student_number: 'U2023/5002',
    staff_number: null,
    department: 'English',
    level: '300 Level',
    phone: null,
    created_at: '2026-09-01T09:00:00+00:00',
    last_active_at: null,
    course_ids: [COURSE],
    course_count: 1,
    ...overrides,
  }
}

/** A refused call, as PostgREST reports it. */
const refusal = (code: string) => ({ data: null, error: { code, message: 'raw' } })

/** A service whose queries are answered by `answer`, and whose function calls are `invoke`. */
function setup(
  answer: (query: RecordedQuery) => TableAnswer,
  result: FunctionResult = { status: 200, body: { ok: true } },
) {
  const { client, queries } = createFakeTables(answer, { userId: ADMIN })
  const invoke = vi.fn<(name: string, body: Record<string, unknown>) => Promise<FunctionResult>>(
    () => Promise.resolve(result),
  )
  return { service: createSupabaseUserService({ client, invoke }), queries, invoke }
}

describe('listUsers', () => {
  // Proves the list counts first, then reads one page of one role in order.
  it('counts, then reads one page', async () => {
    const { service, queries } = setup((query) =>
      made(query, 'select', 'id', { count: 'exact', head: true })
        ? { data: null, error: null, count: 45 }
        : { data: [userRow()], error: null },
    )
    const page = await service.listUsers({ role: 'student', page: 2, sort: '-created' })
    expect(page).toMatchObject({ total: 45, page: 2, pageSize: 20 })
    expect(page.items[0]).toMatchObject({
      fullName: 'Ada Eze',
      studentNumber: 'U2023/5002',
      courseCount: 1,
      createdAt: '2026-09-01T09:00:00.000Z',
      lastActiveAt: null,
    })
    const read = queries[1]!
    expect(made(read, 'eq', 'role', 'student')).toBe(true)
    expect(made(read, 'order', 'created_at', { ascending: false, nullsFirst: false })).toBe(true)
    expect(made(read, 'range', 20, 39)).toBe(true)
  })

  // Proves accounts that were never active sort last whichever way the list runs.
  it.each([
    ['lastActive', true],
    ['-lastActive', false],
  ] as const)('sorts by %s with never-active accounts last', async (sort, ascending) => {
    const { service, queries } = setup((query) =>
      made(query, 'select', 'id', { count: 'exact', head: true })
        ? { data: null, error: null, count: 1 }
        : { data: [userRow()], error: null },
    )
    await service.listUsers({ role: 'student', sort })
    expect(made(queries[1]!, 'order', 'last_active_at', { ascending, nullsFirst: false })).toBe(
      true,
    )
  })

  // Proves the filters become the matching conditions.
  it('filters by status, department and course', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null, count: 0 }))
    await service.listUsers({
      role: 'teacher',
      status: 'suspended',
      department: 'English',
      courseId: COURSE,
    })
    const query = queries[0]!
    expect(made(query, 'eq', 'status', 'suspended')).toBe(true)
    expect(made(query, 'eq', 'department', 'English')).toBe(true)
    expect(made(query, 'contains', 'course_ids', [COURSE])).toBe(true)
  })

  // SECURITY: proves a search cannot add conditions of its own to the filter.
  it('keeps filter characters in a search out of the query', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null, count: 0 }))
    await service.listUsers({ role: 'student', q: 'x),role.eq.admin,(' })
    const search = queries[0]!.calls.find((call) => call[0] === 'or')
    // Still exactly the four conditions of the search; the typed text is only inside them.
    const parts = String(search?.[1]).split(',')
    expect(parts).toHaveLength(4)
    expect(
      parts.every((part) => /^(full_name|email|student_number|staff_number)\.ilike\.%/.test(part)),
    ).toBe(true)
  })

  // SECURITY: proves a course ID that is not a UUID matches nothing and never reaches a query.
  it('matches nothing for a course ID that is not a UUID', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null, count: 5 }))
    await expect(service.listUsers({ role: 'student', courseId: 'nope' })).resolves.toMatchObject({
      total: 0,
    })
    expect(queries).toHaveLength(0)
  })

  // Proves a page past the end shows the last page, and an empty list makes no second request.
  it('shows the last page, and reads nothing when nothing matches', async () => {
    const { service } = setup((query) =>
      made(query, 'select', 'id', { count: 'exact', head: true })
        ? { data: null, error: null, count: 23 }
        : { data: [userRow()], error: null },
    )
    expect((await service.listUsers({ role: 'student', page: 9 })).page).toBe(2)
    const empty = setup(() => ({ data: null, error: null, count: 0 }))
    await empty.service.listUsers({ role: 'student' })
    expect(empty.queries).toHaveLength(1)
  })

  // Proves a refused read becomes an AppError.
  it('reports a refused read', async () => {
    const { service } = setup(() => refusal('42501'))
    await expect(service.listUsers({ role: 'student' })).rejects.toMatchObject({
      kind: 'forbidden',
    })
  })
})

describe('listFilterOptions', () => {
  // Proves departments and courses in use are listed A to Z.
  it('offers departments and courses in order', async () => {
    const { service, queries } = setup((query) =>
      query.table === 'admin_departments'
        ? { data: [{ department: 'English' }, { department: 'Biology' }], error: null }
        : {
            data: [
              { id: 'b', code: 'PHY 101', title: 'Physics' },
              { id: 'a', code: 'MTH 202', title: 'Linear Algebra' },
            ],
            error: null,
          },
    )
    const options = await service.listFilterOptions()
    expect(options.departments).toEqual(['Biology', 'English'])
    expect(options.courses.map((course) => course.code)).toEqual(['MTH 202', 'PHY 101'])
    expect(
      made(
        queries.find((query) => query.table === 'admin_courses')!,
        'is',
        'archived_at',
        null,
      ),
    ).toBe(true)
  })
})

describe('getUser', () => {
  /** A service over an account with `history` in the audit log. */
  function over(history: unknown[]) {
    return setup((query) => {
      if (query.table === 'admin_users') return { data: userRow(), error: null }
      if (query.table === 'admin_courses') {
        return { data: [{ id: COURSE, code: 'MTH 202', title: 'Linear Algebra' }], error: null }
      }
      if (query.table === 'audit_logs') return { data: history, error: null }
      return { data: [{ id: ADMIN, full_name: 'Amara Okafor' }], error: null }
    })
  }

  // SECURITY: proves an ID that is not a UUID never reaches a query.
  it('does not query for an ID that is not a UUID', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null }))
    await expect(service.getUser('nobody')).rejects.toMatchObject({ kind: 'not_found' })
    expect(queries).toHaveLength(0)
  })

  // Proves an unknown account is not found.
  it('rejects an unknown account', async () => {
    const { service } = setup(() => ({ data: null, error: null }))
    await expect(service.getUser(USER)).rejects.toMatchObject({
      kind: 'not_found',
      message: 'User not found.',
    })
  })

  // Proves the history reads the invitation and each change, names the administrator who made it
  // and leaves the name out when the account made the change itself.
  it('reads the status history from the audit log', async () => {
    const { service, queries } = over([
      {
        actor_id: ADMIN,
        action: 'user.invited',
        metadata: { role: 'student', status: 'pending' },
        created_at: '2026-09-01T09:00:00+00:00',
      },
      {
        actor_id: USER,
        action: 'user.status_changed',
        metadata: { from: 'pending', to: 'active' },
        created_at: '2026-09-02T09:00:00+00:00',
      },
      {
        actor_id: null,
        action: 'user.status_changed',
        metadata: {},
        created_at: '2026-09-03T09:00:00+00:00',
      },
    ])
    const details = await service.getUser(USER)
    expect(details.statusHistory).toEqual([
      { status: 'pending', at: '2026-09-01T09:00:00.000Z', byName: 'Amara Okafor' },
      { status: 'active', at: '2026-09-02T09:00:00.000Z', byName: null },
      // An entry with no recorded status reads as pending, as an invitation does.
      { status: 'pending', at: '2026-09-03T09:00:00.000Z', byName: null },
    ])
    expect(details.courses).toEqual([{ id: COURSE, code: 'MTH 202', title: 'Linear Algebra' }])
    expect(details).toMatchObject({ level: '300 Level', phone: null })
    const audit = queries.find((query) => query.table === 'audit_logs')!
    expect(made(audit, 'eq', 'entity_id', USER)).toBe(true)
    expect(made(audit, 'in', 'action', ['user.invited', 'user.status_changed'])).toBe(true)
  })

  // Proves an account with no courses and no history makes no extra requests.
  it('skips the lookups it does not need', async () => {
    const { service, queries } = setup((query) =>
      query.table === 'admin_users'
        ? { data: userRow({ course_ids: [], course_count: 0 }), error: null }
        : { data: [], error: null },
    )
    await service.getUser(USER)
    expect(queries.map((query) => query.table).sort()).toEqual(['admin_users', 'audit_logs'])
  })
})

describe('inviteUser', () => {
  /** A valid invitation, as the form sends it. */
  const INVITE = {
    role: 'teacher',
    fullName: ' Ngozi ',
    email: ' Ngozi@Conote.Example ',
    department: 'English',
  } as const

  // Proves the form rules run before any call.
  it('validates before calling the function', async () => {
    const { service, invoke } = setup(() => ({ data: null, error: null }))
    await expect(service.inviteUser({ ...INVITE, fullName: '' })).rejects.toMatchObject({
      kind: 'validation',
    })
    expect(invoke).not.toHaveBeenCalled()
  })

  // Proves the function gets the tidied values, and the new account is read back.
  it('calls the function with the tidied values and returns the new account', async () => {
    const { service, invoke } = setup(
      (query) =>
        query.table === 'admin_users'
          ? { data: userRow({ id: USER, role: 'teacher', status: 'pending' }), error: null }
          : { data: [], error: null },
      { status: 200, body: { userId: USER } },
    )
    const invited = await service.inviteUser(INVITE)
    expect(invoke).toHaveBeenCalledWith('invite-user', {
      role: 'teacher',
      fullName: 'Ngozi',
      email: 'ngozi@conote.example',
      department: 'English',
    })
    expect(invited).toMatchObject({ id: USER, status: 'pending' })
  })

  // Proves a refusal from the function reaches the screen as the same kind of error.
  it('reports the function’s refusal', async () => {
    const { service } = setup(() => ({ data: null, error: null }), {
      status: 409,
      body: { error: { kind: 'conflict', message: 'An account with this email already exists.' } },
    })
    await expect(service.inviteUser(INVITE)).rejects.toMatchObject({
      kind: 'conflict',
      message: 'An account with this email already exists.',
    })
  })
})

describe('updateUser', () => {
  /** A valid edit, as the form sends it. */
  const EDIT = {
    fullName: ' Ada Eze ',
    department: 'English',
    level: '',
    phone: '+234 803',
    studentNumber: 'U2023/9999',
    staffNumber: null,
  }

  /** A service over an account, with the profile function answering `rpcAnswer`. */
  function over(rpcAnswer: TableAnswer) {
    return setup((query) =>
      query.table === 'rpc:admin_update_profile'
        ? rpcAnswer
        : query.table === 'admin_users'
          ? { data: userRow(), error: null }
          : { data: [], error: null },
    )
  }

  // Proves the tidied values go to the database function.
  it('sends the tidied values to the database function', async () => {
    const { service, queries } = over({ data: null, error: null })
    await service.updateUser(USER, EDIT)
    const call = queries.find((query) => query.table === 'rpc:admin_update_profile')!
    expect(
      made(call, 'rpc', {
        p_user: USER,
        p_full_name: 'Ada Eze',
        p_department: 'English',
        p_level: null,
        p_phone: '+234 803',
        p_student_number: 'U2023/9999',
        p_staff_number: null,
      }),
    ).toBe(true)
  })

  // Proves an unknown account is not found, and bad input is a validation error.
  it('rejects an unknown account and invalid input', async () => {
    const unknown = setup(() => ({ data: null, error: null }))
    await expect(unknown.service.updateUser(USER, EDIT)).rejects.toMatchObject({
      kind: 'not_found',
    })
    await expect(unknown.service.updateUser('nobody', EDIT)).rejects.toMatchObject({
      kind: 'not_found',
    })
    await expect(
      over({ data: null, error: null }).service.updateUser(USER, { ...EDIT, fullName: ' ' }),
    ).rejects.toMatchObject({
      kind: 'validation',
    })
  })

  // Proves a number already used by someone else is a conflict with its own message.
  it('reports a number that is already in use', async () => {
    await expect(over(refusal('23505')).service.updateUser(USER, EDIT)).rejects.toMatchObject({
      kind: 'conflict',
      message: 'That student or staff number is already in use.',
    })
    await expect(over(refusal('42501')).service.updateUser(USER, EDIT)).rejects.toMatchObject({
      kind: 'forbidden',
    })
  })
})

describe('setUserStatus and sendPasswordReset', () => {
  /** A service over an account. */
  function over(result?: FunctionResult) {
    return setup(
      (query) =>
        query.table === 'admin_users'
          ? { data: userRow({ status: 'suspended' }), error: null }
          : { data: [], error: null },
      result,
    )
  }

  // Proves a status change is one call to the function, then the account is read back.
  it('changes a status through the function', async () => {
    const { service, invoke } = over()
    const details = await service.setUserStatus(USER, 'suspended')
    expect(invoke).toHaveBeenCalledWith('set-user-status', { userId: USER, status: 'suspended' })
    expect(details.status).toBe('suspended')
  })

  // Proves the function's refusals (the rules live there) reach the screen.
  it('reports the function’s refusals', async () => {
    const { service } = over({
      status: 400,
      body: {
        error: { kind: 'validation', message: "You can't change your own account's status." },
      },
    })
    await expect(service.setUserStatus(USER, 'inactive')).rejects.toMatchObject({
      kind: 'validation',
      message: "You can't change your own account's status.",
    })
    await expect(service.sendPasswordReset(USER)).rejects.toMatchObject({ kind: 'validation' })
  })

  // Proves a reset is one call to the function.
  it('sends a password link through the function', async () => {
    const { service, invoke } = over()
    await expect(service.sendPasswordReset(USER)).resolves.toBeUndefined()
    expect(invoke).toHaveBeenCalledWith('send-password-reset', { userId: USER })
  })

  // SECURITY: proves an ID that is not a UUID never reaches a function.
  it('does not call a function for an ID that is not a UUID', async () => {
    const { service, invoke } = over()
    await expect(service.setUserStatus('nobody', 'active')).rejects.toMatchObject({
      kind: 'not_found',
    })
    await expect(service.sendPasswordReset('nobody')).rejects.toMatchObject({ kind: 'not_found' })
    expect(invoke).not.toHaveBeenCalled()
  })
})
