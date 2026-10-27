/**
 * Tests for invite-user: what it checks, what it creates, and what it undoes when a step fails.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { inviteUserHandler } from './inviteUser.ts'
import { NEW_ID, NOW, bodyOf, post, route, sentTo, setupFunction } from '../testSupport.ts'
import { made } from '@conote/testing/fakeTables'

/** A valid invitation. */
const INVITE = {
  role: 'teacher',
  fullName: ' Ngozi Eze ',
  email: ' Ngozi@Conote.Example ',
}

/** A handler over a platform where every step works, unless `routes` or `tweak` say otherwise. */
function build(routes = {}) {
  const made = setupFunction({
    answer: route({ 'profiles:select': { data: [], error: null }, ...routes }),
  })
  return { ...made, handler: inviteUserHandler(made.deps) }
}

describe('invite-user', () => {
  // Proves a valid invitation creates the login, sets the role on the profile, sends the email
  // and writes the audit entry.
  it('invites someone', async () => {
    const { handler, admin, resetPasswordForEmail, queries } = build()
    const response = await handler(post(INVITE))
    expect(response.status).toBe(200)
    await expect(bodyOf(response)).resolves.toEqual({ userId: NEW_ID })
    // The login: confirmed, with no password, marked as invited.
    expect(admin.createUser).toHaveBeenCalledWith({
      email: 'ngozi@conote.example',
      email_confirm: true,
      // A teacher's also holds the address of the sign-in page, which the invitation email shows
      // instead of a link (D118).
      user_metadata: {
        full_name: 'Ngozi Eze',
        invited: true,
        login_url: 'https://teacher.example/teacher/login',
      },
    })
    // SECURITY: the role is set on the profile by the server.
    expect(sentTo(queries, 'profiles', 'update')).toEqual({
      role: 'teacher',
      status: 'pending',
      created_at: NOW.toISOString(),
    })
    // The email points at the teacher app.
    expect(resetPasswordForEmail).toHaveBeenCalledWith('ngozi@conote.example', {
      redirectTo: 'https://teacher.example/teacher/reset-password',
    })
    // The audit entry names the administrator, the person and the role, and nothing else.
    expect(sentTo(queries, 'audit_logs', 'insert')).toMatchObject({
      actor_role: 'admin',
      action: 'user.invited',
      entity_type: 'user',
      entity_id: NEW_ID,
      metadata: { role: 'teacher', status: 'pending' },
      created_at: NOW.toISOString(),
    })
  })

  // Proves a department sent along is not stored, and an administrator's email goes to the admin
  // app.
  it('stores no department and sends an administrator to the admin app', async () => {
    const { handler, resetPasswordForEmail, queries } = build()
    await handler(post({ ...INVITE, role: 'admin', department: 'English' }))
    expect(sentTo(queries, 'profiles', 'update')).not.toHaveProperty('department')
    expect(resetPasswordForEmail).toHaveBeenCalledWith('ngozi@conote.example', {
      redirectTo: 'https://admin.example/admin/reset-password',
    })
  })

  // Proves an administrator's invitation carries the admin sign-in page, and a student's carries
  // none, because a student still chooses a password through the link (D118).
  it('gives staff a sign-in address and students none', async () => {
    const staff = build()
    await staff.handler(post({ ...INVITE, role: 'admin' }))
    expect(staff.admin.createUser.mock.calls[0]?.[0]).toMatchObject({
      user_metadata: { login_url: 'https://admin.example/admin/login' },
    })
    const student = build()
    await student.handler(post({ ...INVITE, role: 'student' }))
    const attributes = student.admin.createUser.mock.calls[0]?.[0]
    expect(attributes).toMatchObject({ user_metadata: { full_name: 'Ngozi Eze', invited: true } })
    expect(attributes).not.toHaveProperty('user_metadata.login_url')
  })

  // Proves a student's email goes to the student app.
  it('sends a student to the student app', async () => {
    const { handler, resetPasswordForEmail } = build()
    await handler(post({ ...INVITE, role: 'student' }))
    expect(resetPasswordForEmail).toHaveBeenCalledWith('ngozi@conote.example', {
      redirectTo: 'https://app.example/reset-password',
    })
  })

  // Proves bad input is refused before anything is created.
  it.each([
    [{ ...INVITE, fullName: ' ' }, 'Enter a name.'],
    [{ ...INVITE, email: 'nope' }, 'Enter a valid email address.'],
    [{ ...INVITE, role: 'owner' }, 'Invalid option: expected one of "student"|"teacher"|"admin"'],
  ])('refuses invalid input %#', async (body, message) => {
    const { handler, admin } = build()
    const response = await handler(post(body))
    expect(response.status).toBe(400)
    await expect(bodyOf(response)).resolves.toMatchObject({
      error: { kind: 'validation', message },
    })
    expect(admin.createUser).not.toHaveBeenCalled()
  })

  // Proves an address that already has an account is a conflict, in any letter case.
  it('refuses an address that already has an account', async () => {
    const { handler, admin } = build({ 'profiles:select': { data: [{ id: 'x' }], error: null } })
    const response = await handler(post(INVITE))
    expect(response.status).toBe(409)
    expect(admin.createUser).not.toHaveBeenCalled()
  })

  // Proves two invitations at the same moment cannot both create the account.
  it('reports an account made in the meantime as a conflict', async () => {
    const { handler, admin } = build()
    admin.createUser.mockResolvedValueOnce({
      data: { user: null },
      error: { code: 'email_exists' },
    })
    expect((await handler(post(INVITE))).status).toBe(409)
  })

  // Proves each failing step is reported, and a half-made account is removed.
  it('reports a failed lookup', async () => {
    const { handler } = build({ 'profiles:select': { data: null, error: { code: 'XX000' } } })
    expect((await handler(post(INVITE))).status).toBe(502)
  })

  it('reports a login that could not be created', async () => {
    const { handler, admin } = build()
    admin.createUser.mockResolvedValueOnce({
      data: { user: null },
      error: { code: 'unexpected' },
    })
    expect((await handler(post(INVITE))).status).toBe(502)
  })

  it('removes the login when the profile cannot be set', async () => {
    const { handler, admin } = build({
      'profiles:update': { data: null, error: { code: 'XX000' } },
    })
    expect((await handler(post(INVITE))).status).toBe(502)
    expect(admin.deleteUser).toHaveBeenCalledWith(NEW_ID)
  })

  it('removes the login when the email cannot be sent', async () => {
    const { handler, admin, resetPasswordForEmail } = build()
    resetPasswordForEmail.mockResolvedValueOnce({
      data: {},
      error: { code: 'over_email_send_rate_limit' },
    })
    const response = await handler(post(INVITE))
    expect(response.status).toBe(502)
    await expect(bodyOf(response)).resolves.toMatchObject({
      error: { message: 'The invitation email could not be sent. Try again.' },
    })
    expect(admin.deleteUser).toHaveBeenCalledWith(NEW_ID)
  })

  it('reports a failed audit entry', async () => {
    const { handler } = build({ 'audit_logs:insert': { data: null, error: { code: 'XX000' } } })
    expect((await handler(post(INVITE))).status).toBe(502)
  })
})

/** Two courses an administrator chose, as the database knows them. */
const COURSE_A = '44444444-4444-4444-8444-444444444444'
const COURSE_B = '55555555-5555-4555-8555-555555555555'

/** A handler where the courses named in `found` are in use, so the lookup finds exactly those. */
function buildWithCourses(routes = {}, found = [COURSE_A, COURSE_B]) {
  return build({
    'courses:select': { data: found.map((id) => ({ id })), error: null },
    ...routes,
  })
}

describe('invite-user: courses for a teacher (D116)', () => {
  // Proves the courses are looked up first, in use only, and kept with the invitation for the
  // moment the teacher accepts it.
  it('keeps the chosen courses with the invitation', async () => {
    const { handler, queries } = buildWithCourses()
    const response = await handler(post({ ...INVITE, courseIds: [COURSE_A, COURSE_B] }))
    expect(response.status).toBe(200)
    // The lookup asked for exactly these courses, and not archived ones.
    const lookup = queries.find((query) => query.table === 'courses')
    expect(lookup && made(lookup, 'in', 'id', [COURSE_A, COURSE_B])).toBe(true)
    expect(lookup && made(lookup, 'is', 'archived_at', null)).toBe(true)
    // The choice is written for the new account.
    expect(sentTo(queries, 'invited_courses', 'insert')).toEqual([
      { user_id: NEW_ID, course_id: COURSE_A },
      { user_id: NEW_ID, course_id: COURSE_B },
    ])
    // The audit entry says which courses were chosen.
    expect(sentTo(queries, 'audit_logs', 'insert')).toMatchObject({
      metadata: { role: 'teacher', status: 'pending', courseIds: [COURSE_A, COURSE_B] },
    })
  })

  // Proves the courses are not assigned now: the course rule needs an active teacher, so the
  // function writes no course.
  it('does not change any course now', async () => {
    const { handler, queries } = buildWithCourses({}, [COURSE_A])
    const response = await handler(post({ ...INVITE, courseIds: [COURSE_A] }))
    expect(response.status).toBe(200)
    expect(sentTo(queries, 'courses', 'update')).toBeUndefined()
  })

  // Proves an invitation with no courses touches neither table, as before.
  it('looks up and stores nothing when no course is chosen', async () => {
    const { handler, queries } = buildWithCourses()
    await handler(post(INVITE))
    expect(queries.some((query) => query.table === 'courses')).toBe(false)
    expect(queries.some((query) => query.table === 'invited_courses')).toBe(false)
    await handler(post({ ...INVITE, courseIds: [] }))
    expect(queries.some((query) => query.table === 'invited_courses')).toBe(false)
  })

  // Proves the same course chosen twice counts once.
  it('counts a course chosen twice once', async () => {
    const { handler, queries } = build({
      'courses:select': { data: [{ id: COURSE_A }], error: null },
    })
    const response = await handler(post({ ...INVITE, courseIds: [COURSE_A, COURSE_A] }))
    expect(response.status).toBe(200)
    expect(sentTo(queries, 'invited_courses', 'insert')).toEqual([
      { user_id: NEW_ID, course_id: COURSE_A },
    ])
  })

  // Proves an unknown or archived course refuses the whole invitation, before anything is created.
  it('refuses a course that is missing or archived, creating nothing', async () => {
    const { handler, admin, resetPasswordForEmail } = build({
      'courses:select': { data: [{ id: COURSE_A }], error: null },
    })
    const response = await handler(post({ ...INVITE, courseIds: [COURSE_A, COURSE_B] }))
    expect(response.status).toBe(400)
    await expect(bodyOf(response)).resolves.toMatchObject({
      error: { kind: 'validation', message: 'One of the chosen courses is not available.' },
    })
    expect(admin.createUser).not.toHaveBeenCalled()
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })

  // Proves a failed course lookup is reported and creates nothing.
  it('reports a failed course lookup, creating nothing', async () => {
    const { handler, admin } = build({
      'courses:select': { data: null, error: { code: 'XX000' } },
    })
    expect((await handler(post({ ...INVITE, courseIds: [COURSE_A] }))).status).toBe(502)
    expect(admin.createUser).not.toHaveBeenCalled()
  })

  // SECURITY: courses are for teachers only, so a student or administrator invitation that carries
  // some is refused, whatever the console sent.
  it.each(['student', 'admin'])('refuses courses for a %s', async (role) => {
    const { handler, admin } = buildWithCourses()
    const response = await handler(post({ ...INVITE, role, courseIds: [COURSE_A] }))
    expect(response.status).toBe(400)
    await expect(bodyOf(response)).resolves.toMatchObject({
      error: { kind: 'validation', message: 'Only teachers can be given courses.' },
    })
    expect(admin.createUser).not.toHaveBeenCalled()
  })

  // SECURITY: an ID that is not a UUID, or a long list, never reaches the database.
  it.each([
    [['not-a-uuid']],
    [
      Array.from(
        { length: 21 },
        (_, index) => `${String(index).padStart(8, '0')}-4444-4444-8444-444444444444`,
      ),
    ],
  ])('refuses a bad course list %#', async (courseIds) => {
    const { handler, admin, queries } = buildWithCourses()
    const response = await handler(post({ ...INVITE, courseIds }))
    expect(response.status).toBe(400)
    expect(admin.createUser).not.toHaveBeenCalled()
    expect(queries.some((query) => query.table === 'courses')).toBe(false)
  })

  // Proves a choice that cannot be saved removes the half-made account, like any other failed step.
  it('removes the login when the choice cannot be saved', async () => {
    const { handler, admin, resetPasswordForEmail } = buildWithCourses(
      { 'invited_courses:insert': { data: null, error: { code: 'XX000' } } },
      [COURSE_A],
    )
    const response = await handler(post({ ...INVITE, courseIds: [COURSE_A] }))
    expect(response.status).toBe(502)
    expect(admin.deleteUser).toHaveBeenCalledWith(NEW_ID)
    // No email goes to someone whose account was just removed.
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })
})
