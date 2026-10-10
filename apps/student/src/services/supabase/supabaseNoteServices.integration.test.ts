/**
 * Runs the note and summary contracts against a real Supabase project, plus the checks only a real
 * database can answer: that notes stay private from other students and from administrators, that
 * a draft summary never reaches a student, and that the database refuses what the app would never
 * send. It needs the seed from supabase/seed.sql and is skipped unless VITE_SUPABASE_TEST_*
 * variables point at a project, so `npm test` never touches the network. CI starts a local
 * Supabase stack and sets them (see the "Supabase contract tests" job). NEVER point it at a hosted
 * project: it deletes the demo student's notes and views.
 */

// Vitest building blocks.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// The shared contracts every implementation must meet.
import { runNotesServiceContract } from '../contracts/notesService.contract'
import { runSummaryServiceContract } from '../contracts/summaryService.contract'

// What the real-backend tests share.
import {
  ADMIN_EMAIL,
  CONFIGURED,
  EMAIL,
  OTHER_EMAIL,
  serverClient,
  signedIn,
} from './integrationSupport'

// The implementations under test.
import { createSupabaseClassService } from './supabaseClassService'
import { createSupabaseNoteService } from './supabaseNoteService'
import { createSupabaseSummaryService } from './supabaseSummaryService'

// The seed's IDs (supabase/seed.sql).
const STUDENT_ID = '10000000-0000-0000-0000-000000000004'
const MTH = '20000000-0000-0000-0000-000000000001'
const SWE = '20000000-0000-0000-0000-000000000002'
const MTH_CLASS_1 = '30000000-0000-0000-0000-000000000001'
const MTH_CLASS_2 = '30000000-0000-0000-0000-000000000002'
const SWE_CLASS_1 = '30000000-0000-0000-0000-000000000003'
// A class of PHY 101, which the demo student is not in.
const PHY_CLASS = '30000000-0000-0000-0000-000000000004'

describe.skipIf(!CONFIGURED)('Supabase note and summary services', () => {
  // The demo student, a second student in the same course, an administrator, and the server.
  let student: SupabaseClient
  let other: SupabaseClient
  let admin: SupabaseClient
  let server: SupabaseClient

  beforeAll(async () => {
    student = await signedIn(EMAIL ?? '', 'conote-test-notes-student')
    other = await signedIn(OTHER_EMAIL ?? '', 'conote-test-notes-other')
    admin = await signedIn(ADMIN_EMAIL ?? '', 'conote-test-notes-admin')
    server = serverClient()
  })

  afterAll(async () => {
    await student.auth.signOut()
    await other.auth.signOut()
    await admin.auth.signOut()
  })

  // Every test starts with no notes and no opened summaries for the demo student.
  beforeEach(async () => {
    await server.from('notes').delete().eq('student_id', STUDENT_ID)
    await server.from('summary_views').delete().eq('student_id', STUDENT_ID)
  })

  runNotesServiceContract('Supabase', {
    fixture: {
      classA: MTH_CLASS_1,
      courseA: MTH,
      classB: SWE_CLASS_1,
      courseB: SWE,
      foreignClass: PHY_CLASS,
    },
    create: () => ({ notes: createSupabaseNoteService({ client: student }) }),
  })

  runSummaryServiceContract('Supabase', {
    // MTH class 2 is waiting for review; SWE class 1 has no summary yet.
    fixture: { unpublished: [MTH_CLASS_2, SWE_CLASS_1] },
    create: () => ({
      summaries: createSupabaseSummaryService({ client: student }),
      classes: createSupabaseClassService({ client: student }),
    }),
  })

  describe('beyond the contract', () => {
    // SECURITY: proves a note is private. Another student in the same course, an administrator
    // and a direct table read all see nothing of it, and cannot change or delete it.
    it('keeps a note from other students and from administrators', async () => {
      const note = await createSupabaseNoteService({ client: student }).createNote({
        classId: MTH_CLASS_1,
        title: 'Private',
        contentHtml: '<p>Only mine</p>',
        tags: [],
      })

      for (const outsider of [other, admin]) {
        const service = createSupabaseNoteService({ client: outsider })
        await expect(service.listMyNotes()).resolves.toEqual([])
        await expect(service.getNote(note.id)).rejects.toMatchObject({ kind: 'not_found' })
        await expect(service.deleteNote(note.id)).rejects.toMatchObject({ kind: 'not_found' })
        const direct = await outsider.from('notes').select('id').eq('id', note.id)
        expect(direct.data).toEqual([])
      }
      // The note is still there for its author.
      await expect(
        createSupabaseNoteService({ client: student }).getNote(note.id),
      ).resolves.toMatchObject({ id: note.id })
    })

    // SECURITY: proves a student cannot write a note as another student, or in a course not joined.
    it('refuses a note written as someone else or in a course not joined', async () => {
      const otherId = '10000000-0000-0000-0000-000000000005'
      const forged = await student.from('notes').insert({
        student_id: otherId,
        course_id: MTH,
        class_id: MTH_CLASS_1,
        content_html: '<p>x</p>',
      })
      expect(forged.error).not.toBeNull()

      const phy = await student.from('notes').insert({
        course_id: '20000000-0000-0000-0000-000000000003',
        class_id: PHY_CLASS,
        content_html: '<p>x</p>',
      })
      expect(phy.error).not.toBeNull()
    })

    // SECURITY: proves the database enforces the size limits for a request that skips the app.
    it('refuses an oversized note, too many tags and a long title', async () => {
      const base = { course_id: MTH, class_id: MTH_CLASS_1 }

      const huge = await student
        .from('notes')
        .insert({ ...base, content_html: 'x'.repeat(200_001) })
      const tags = await student
        .from('notes')
        .insert({ ...base, tags: Array.from({ length: 11 }, (_, i) => `t${String(i)}`) })
      const title = await student.from('notes').insert({ ...base, title: 't'.repeat(121) })

      for (const result of [huge, tags, title]) {
        expect(result.error?.code).toBe('23514')
      }
    })

    // SECURITY: proves a draft summary never reaches a student, by any route. The seed has one
    // published summary and one waiting for review in the student's course.
    it('shows a student only published summaries', async () => {
      const direct = await student.from('summaries').select('id, status, overview')

      expect(direct.error).toBeNull()
      expect(direct.data).toHaveLength(1)
      expect(direct.data?.every((row) => row.status === 'published')).toBe(true)
      const service = createSupabaseSummaryService({ client: student })
      await expect(service.getByClass(MTH_CLASS_2)).rejects.toMatchObject({ kind: 'not_found' })
    })

    // SECURITY: proves a student cannot publish, or edit, a summary.
    it('refuses a student editing or publishing a summary', async () => {
      const draft = await student
        .from('summaries')
        .update({ overview: 'hacked' })
        .eq('class_id', MTH_CLASS_2)
        .select('id')
      expect(draft.data ?? []).toEqual([])

      const publish = await student
        .from('summaries')
        .update({ status: 'published' })
        .eq('class_id', MTH_CLASS_2)
      expect(publish.error).not.toBeNull()

      const rpc = await student.rpc('publish_summary', {
        p_summary: '00000000-0000-4000-8000-000000000000',
        p_version: 1,
      })
      expect(rpc.error).not.toBeNull()
    })

    // Proves a view is private to the student who opened the summary.
    it('keeps who opened a summary private', async () => {
      const summaries = createSupabaseSummaryService({ client: student })
      const [published] = await summaries.listPublished()
      await summaries.markViewed(published?.id ?? '')

      const seen = await createSupabaseSummaryService({ client: other }).getByClass(MTH_CLASS_1)
      const direct = await other.from('summary_views').select('student_id')

      expect(seen.viewedByMe).toBe(false)
      expect(direct.data).toEqual([])
    })
  })
})
