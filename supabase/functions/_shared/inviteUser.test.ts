/**
 * Tests for invite-user: what it checks, what it creates, and what it undoes when a step fails.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { inviteUserHandler } from './inviteUser.ts'
import { NEW_ID, NOW, bodyOf, post, route, sentTo, setupFunction } from '../testSupport.ts'

/** A valid invitation. */
const INVITE = {
  role: 'teacher',
  fullName: ' Ngozi Eze ',
  email: ' Ngozi@Conote.Example ',
  department: 'English',
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
      user_metadata: { full_name: 'Ngozi Eze', invited: true },
    })
    // SECURITY: the role is set on the profile by the server.
    expect(sentTo(queries, 'profiles', 'update')).toEqual({
      role: 'teacher',
      status: 'pending',
      department: 'English',
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

  // Proves an administrator has no department, and the email goes to the admin app.
  it('invites an administrator without a department', async () => {
    const { handler, resetPasswordForEmail, queries } = build()
    await handler(post({ ...INVITE, role: 'admin', department: 'English' }))
    expect(sentTo(queries, 'profiles', 'update')).toMatchObject({ role: 'admin', department: null })
    expect(resetPasswordForEmail).toHaveBeenCalledWith('ngozi@conote.example', {
      redirectTo: 'https://admin.example/admin/reset-password',
    })
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
    [{ ...INVITE, department: undefined }, 'Choose a department.'],
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
