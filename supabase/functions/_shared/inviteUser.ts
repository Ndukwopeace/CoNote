/**
 * invite-user: an administrator invites someone by email (admin REQUIREMENTS section 11). The
 * account is created without a password and marked "pending"; the email lets the person choose a
 * password on their app's reset page, which also accepts the invitation.
 */

// Checks the body.
import { z } from 'zod'

// The shared steps and answers.
import { adminHandler, type FunctionDeps } from './admin.ts'
import { resetAddress } from './env.ts'
import { json, refuse } from './http.ts'

/** The most courses one invitation may carry; the console's list is far shorter. */
const MAX_COURSES = 20

/** The body: the same rules as the console's invite form. */
const bodySchema = z
  .object({
    role: z.enum(['student', 'teacher', 'admin']),
    fullName: z.string().trim().min(1, 'Enter a name.').max(100, 'Use at most 100 characters.'),
    // Trimmed and in lower case, so the same address can't be invited twice in different cases.
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.')),
    // The courses a new teacher will teach (D116). SECURITY: each must look like an ID and there
    // are few, so nothing else reaches the database.
    courseIds: z.array(z.guid()).max(MAX_COURSES).optional(),
  })
  // SECURITY: courses are for teachers only, whatever the console sent.
  .refine((body) => body.role === 'teacher' || (body.courseIds ?? []).length === 0, {
    message: 'Only teachers can be given courses.',
    path: ['courseIds'],
  })

/** Builds the handler. */
export function inviteUserHandler(deps: FunctionDeps) {
  return adminHandler(deps, bodySchema, async ({ actorId, body }) => {
    const { service, anon } = deps.clients
    const at = deps.now().toISOString()
    // One account per email.
    const existing = await service.from('profiles').select('id').eq('email', body.email).limit(1)
    if (existing.error) return refuse('unknown', 'Something went wrong. Try again.')
    if (existing.data.length > 0) {
      return refuse('conflict', 'An account with this email already exists.')
    }
    // The courses chosen for a teacher, each once. They are checked before anything is created, so
    // a course that is gone or archived refuses the whole invitation and leaves nothing behind.
    const courseIds = [...new Set(body.courseIds ?? [])]
    if (courseIds.length > 0) {
      const found = await service
        .from('courses')
        .select('id')
        .in('id', courseIds)
        .is('archived_at', null)
      if (found.error) return refuse('unknown', 'Something went wrong. Try again.')
      if (found.data.length !== courseIds.length) {
        return refuse('validation', 'One of the chosen courses is not available.')
      }
    }
    // The login, without a password. The sign-up trigger makes the profile, always as a student.
    const created = await service.auth.admin.createUser({
      email: body.email,
      email_confirm: true,
      user_metadata: { full_name: body.fullName, invited: true },
    })
    const userId = created.data.user?.id
    if (created.error || !userId) {
      // Someone else invited the same address between the check and now.
      if (created.error?.code === 'email_exists') {
        return refuse('conflict', 'An account with this email already exists.')
      }
      return refuse('unknown', 'Something went wrong. Try again.')
    }
    // SECURITY: the role and status are set here, by the server, on the profile row. The sign-up
    // trigger ignores any role the browser sends, and this is the only place a role is chosen.
    const profile = await service
      .from('profiles')
      .update({
        role: body.role,
        status: 'pending',
        created_at: at,
      })
      .eq('id', userId)
    // Undo the login if the profile could not be set, so no half-made account is left.
    if (profile.error) {
      await service.auth.admin.deleteUser(userId)
      return refuse('unknown', 'Something went wrong. Try again.')
    }
    // The chosen courses are kept with the invitation, not given now: a course may only go to an
    // active teacher, so accept_invitation hands them over when the teacher accepts. If they
    // cannot be kept, the account is removed, like any other failed step.
    if (courseIds.length > 0) {
      const chosen = await service
        .from('invited_courses')
        .insert(courseIds.map((courseId) => ({ user_id: userId, course_id: courseId })))
      if (chosen.error) {
        await service.auth.admin.deleteUser(userId)
        return refuse('unknown', 'Something went wrong. Try again.')
      }
    }
    // The email with the link to choose a password. It is the one Supabase sends for a password
    // reset; its wording changes for an invited person (supabase/templates/recovery.html).
    const sent = await anon.auth.resetPasswordForEmail(body.email, {
      redirectTo: resetAddress(deps.env, body.role),
    })
    if (sent.error) {
      // Remove the account, so the administrator can simply try again.
      await service.auth.admin.deleteUser(userId)
      return refuse('unknown', 'The invitation email could not be sent. Try again.')
    }
    // 5. The audit entry: who invited whom, with which role. Never anything else.
    const audit = await service.from('audit_logs').insert({
      actor_id: actorId,
      actor_role: 'admin',
      action: 'user.invited',
      entity_type: 'user',
      entity_id: userId,
      metadata: {
        role: body.role,
        status: 'pending',
        // Which courses were chosen, when any were.
        ...(courseIds.length > 0 ? { courseIds } : {}),
      },
      created_at: at,
    })
    if (audit.error) return refuse('unknown', 'Something went wrong. Try again.')
    return json({ userId })
  })
}
