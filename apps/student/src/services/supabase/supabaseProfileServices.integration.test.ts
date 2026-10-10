/**
 * Runs the notification and profile contracts against a real Supabase project, plus the checks
 * only a real database can answer: that one person's notifications and profile stay out of
 * another's hands, that a person cannot promote themselves, and that the database refuses what the
 * app would never send. The subject is the seed's second student (Ada), so these tests never touch
 * the demo student the other suites use. It needs the seed from supabase/seed.sql and is skipped
 * unless VITE_SUPABASE_TEST_* variables point at a project, so `npm test` never touches the
 * network. CI starts a local Supabase stack and sets them (see the "Supabase contract tests" job).
 * NEVER point it at a hosted project: it rewrites Ada's profile and notifications.
 */

// Vitest building blocks.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// The shared contracts every implementation must meet.
import { runNotificationServiceContract } from '../contracts/notificationService.contract'
import { runProfileServiceContract } from '../contracts/profileService.contract'

// What the real-backend tests share.
import { CONFIGURED, EMAIL, OTHER_EMAIL, serverClient, signedIn } from './integrationSupport'

// The implementations under test.
import { createSupabaseNotificationService } from './supabaseNotificationService'
import { createSupabaseProfileService } from './supabaseProfileService'

// The seed's IDs (supabase/seed.sql). Ada is the subject; the demo student is the outsider.
const ADA = '10000000-0000-0000-0000-000000000005'
const DEMO_STUDENT = '10000000-0000-0000-0000-000000000004'
const MTH_CLASS_1 = '30000000-0000-0000-0000-000000000001'
const MTH_CLASS_2 = '30000000-0000-0000-0000-000000000002'

describe.skipIf(!CONFIGURED)('Supabase notification and profile services', () => {
  // Ada (the subject), the demo student (an outsider), and the server (which bypasses RLS).
  let ada: SupabaseClient
  let demo: SupabaseClient
  let server: SupabaseClient

  beforeAll(async () => {
    ada = await signedIn(OTHER_EMAIL ?? '', 'conote-test-profile-ada')
    demo = await signedIn(EMAIL ?? '', 'conote-test-profile-demo')
    server = serverClient()
  })

  afterAll(async () => {
    await ada.auth.signOut()
    await demo.auth.signOut()
  })

  // Every test starts as the seed leaves Ada: her original profile, and three notifications.
  beforeEach(async () => {
    await server
      .from('profiles')
      .update({
        full_name: 'Ada Obi',
        department: null,
        level: null,
        phone: null,
        avatar_url: null,
        notification_prefs: {},
      })
      .eq('id', ADA)
    await server.from('notifications').delete().eq('user_id', ADA)
    await server.from('notifications').insert([
      {
        user_id: ADA,
        type: 'summary',
        title: 'Ada: new summary',
        body: 'Approved.',
        link: `/classes/${MTH_CLASS_1}`,
        read: false,
        created_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      },
      {
        user_id: ADA,
        type: 'system',
        title: 'Ada: class reminder',
        body: 'Soon.',
        link: `/classes/${MTH_CLASS_2}`,
        read: false,
        created_at: new Date(Date.now() - 86_400_000).toISOString(),
      },
      {
        user_id: ADA,
        type: 'note',
        title: 'Ada: welcome',
        body: 'Hello.',
        link: null,
        read: true,
        created_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      },
    ])
  })

  runNotificationServiceContract('Supabase', {
    create: () => ({
      notifications: createSupabaseNotificationService({
        client: ada,
        origin: 'http://localhost:4173',
      }),
    }),
  })

  runProfileServiceContract('Supabase', {
    create: () => ({
      profile: createSupabaseProfileService({
        client: ada,
        afterNameChange: () => Promise.resolve(),
      }),
    }),
    // Pictures wait for file storage.
    supportsAvatar: false,
  })

  describe('beyond the contract', () => {
    // SECURITY: proves notifications are private. Another student sees none of Ada's, and cannot
    // read, mark or change them.
    it('keeps notifications from other students', async () => {
      const outsider = createSupabaseNotificationService({
        client: demo,
        origin: 'http://localhost:4173',
      })

      const titles = (await outsider.list()).map((n) => n.title)

      expect(titles.some((title) => title.startsWith('Ada:'))).toBe(false)
      const adas = await ada.from('notifications').select('id')
      const first = adas.data?.[0]?.id as string
      await expect(outsider.markRead(first)).rejects.toMatchObject({ kind: 'not_found' })
      const direct = await demo
        .from('notifications')
        .update({ read: true })
        .eq('id', first)
        .select('id')
      expect(direct.data ?? []).toEqual([])
    })

    // SECURITY: proves a student cannot write, rewrite or delete notifications: the server does.
    it('refuses a student writing, rewriting or deleting notifications', async () => {
      const forged = await ada
        .from('notifications')
        .insert({ user_id: ADA, type: 'system', title: 'forged' })
      expect(forged.error).not.toBeNull()

      const rewritten = await ada
        .from('notifications')
        .update({ title: 'hacked' })
        .eq('user_id', ADA)
      expect(rewritten.error).not.toBeNull()

      const removed = await ada.from('notifications').delete().eq('user_id', ADA).select('id')
      expect(removed.error !== null || removed.data.length === 0).toBe(true)
      const left = await server.from('notifications').select('id').eq('user_id', ADA)
      expect(left.data).toHaveLength(3)
    })

    // SECURITY: proves a student cannot promote themselves or change their status.
    it('refuses a student changing their own role or status', async () => {
      const role = await ada.from('profiles').update({ role: 'admin' }).eq('id', ADA)
      const status = await ada.from('profiles').update({ status: 'pending' }).eq('id', ADA)
      const number = await ada
        .from('profiles')
        .update({ student_number: 'U0000/0000' })
        .eq('id', ADA)

      for (const result of [role, status, number]) expect(result.error).not.toBeNull()
      const row = await server.from('profiles').select('role, status').eq('id', ADA).single()
      expect(row.data).toEqual({ role: 'student', status: 'active' })
    })

    // SECURITY: proves a student cannot read or change another person's profile.
    it('keeps profiles private', async () => {
      const seen = await ada.from('profiles').select('id')
      expect(seen.data).toEqual([{ id: ADA }])

      const changed = await ada
        .from('profiles')
        .update({ full_name: 'Hijacked' })
        .eq('id', DEMO_STUDENT)
        .select('id')
      expect(changed.data ?? []).toEqual([])
      const other = await server
        .from('profiles')
        .select('full_name')
        .eq('id', DEMO_STUDENT)
        .single()
      expect(other.data?.full_name).toBe('Victory Eze')
    })

    // SECURITY: proves the database refuses a picture address that could run code or track viewers,
    // and oversized or misshapen profile data, for a request that skips the app.
    it('refuses unsafe or oversized profile data', async () => {
      const cases = [
        { avatar_url: 'javascript:alert(1)' },
        { avatar_url: 'http://tracker.example/p.png' },
        { full_name: 'n'.repeat(101) },
        { phone: '1'.repeat(21) },
        { notification_prefs: [1] },
      ]

      for (const change of cases) {
        const result = await ada.from('profiles').update(change).eq('id', ADA)
        expect(result.error?.code).toBe('23514')
      }
    })

    // Proves a renamed student's name is read back by the session, through the real refresh.
    it('keeps the name the profile service saved', async () => {
      const profile = createSupabaseProfileService({
        client: ada,
        afterNameChange: () => Promise.resolve(),
      })

      await profile.updateMe({ fullName: 'Ada Renamed' })

      const row = await server.from('profiles').select('full_name').eq('id', ADA).single()
      expect(row.data?.full_name).toBe('Ada Renamed')
    })
  })
})
