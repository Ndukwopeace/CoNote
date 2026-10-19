/**
 * Runs the course, class and enrolment contracts against a real Supabase project, plus the checks
 * only a real database can answer (Row Level Security hiding other courses). It needs the seed
 * from supabase/seed.sql and is skipped unless VITE_SUPABASE_TEST_* variables point at a project,
 * so `npm test` never touches the network. CI starts a local Supabase stack and sets them (see
 * the "Supabase contract tests" job). NEVER point it at a hosted project: it deletes requests.
 */

// Vitest building blocks.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// The shared contracts every implementation must meet.
import { runCoursesAndClassesContract } from '../contracts/coursesAndClasses.contract'
import { runEnrolmentServiceContract } from '../contracts/enrolmentService.contract'
import { runProgrammeContract } from '../contracts/programmeEnrolment.contract'

// What the real-backend tests share.
import { ADMIN_EMAIL, CONFIGURED, EMAIL, serverClient, signedIn } from './integrationSupport'

// The implementations under test.
import { createSupabaseClassService } from './supabaseClassService'
import { createSupabaseCourseService } from './supabaseCourseService'
import { createSupabaseEnrolmentService } from './supabaseEnrolmentService'

// The seed's IDs (supabase/seed.sql).
const STUDENT_ID = '10000000-0000-0000-0000-000000000004'
const MTH = '20000000-0000-0000-0000-000000000001'
const SWE = '20000000-0000-0000-0000-000000000002'
const PHY = '20000000-0000-0000-0000-000000000003'
const CHM = '20000000-0000-0000-0000-000000000004'
const CSC = '20000000-0000-0000-0000-000000000005'
const ENG = '20000000-0000-0000-0000-000000000006'
// The programmes this suite creates (D105): one open, one closed, one archived.
const PROG_OPEN = '60000000-0000-0000-0000-000000000001'
const PROG_CLOSED = '60000000-0000-0000-0000-000000000002'
const PROG_ARCHIVED = '60000000-0000-0000-0000-000000000003'
const PROG_OTHER = '60000000-0000-0000-0000-000000000004'
// Every programme this suite creates.
const PROGRAMMES = [PROG_OPEN, PROG_CLOSED, PROG_ARCHIVED, PROG_OTHER]

describe.skipIf(!CONFIGURED)('Supabase course services', () => {
  // The signed-in student, the signed-in administrator, and the server (which bypasses RLS).
  let student: SupabaseClient
  let admin: SupabaseClient
  let server: SupabaseClient

  beforeAll(async () => {
    student = await signedIn(EMAIL ?? '', 'conote-test-student')
    admin = await signedIn(ADMIN_EMAIL ?? '', 'conote-test-admin')
    server = serverClient()
    // The programmes: the open one holds a course in use, one not started, one the student is
    // already in, a completed one and an archived one.
    await server.from('programmes').delete().in('id', PROGRAMMES)
    const created = await server.from('programmes').insert([
      { id: PROG_OPEN, code: 'TST-Y1', name: 'Test programme, open', open_enrolment: true },
      { id: PROG_OTHER, code: 'TST-Y4', name: 'Test programme, other', open_enrolment: true },
      { id: PROG_CLOSED, code: 'TST-Y2', name: 'Test programme, closed', open_enrolment: false },
      {
        id: PROG_ARCHIVED,
        code: 'TST-Y3',
        name: 'Test programme, archived',
        open_enrolment: true,
        archived_at: new Date().toISOString(),
      },
    ])
    if (created.error) throw new Error(`Could not create the programmes: ${created.error.message}`)
    const linked = await server
      .from('programme_courses')
      .insert(
        [CHM, PHY, MTH, CSC, ENG].map((course) => ({ programme_id: PROG_OPEN, course_id: course })),
      )
    if (linked.error) throw new Error(`Could not link the courses: ${linked.error.message}`)
  })

  afterAll(async () => {
    // Removing the programmes removes their links; students keep the courses they joined.
    await server.from('programmes').delete().in('id', PROGRAMMES)
    await student.auth.signOut()
    await admin.auth.signOut()
  })

  // Every test starts as the seed leaves the student: no requests, and not in the open course.
  beforeEach(async () => {
    await server.from('enrollment_requests').delete().eq('student_id', STUDENT_ID)
    await server
      .from('enrollments')
      .delete()
      .eq('student_id', STUDENT_ID)
      .in('course_id', [CHM, PHY])
    // No programme joined yet, and no request for one.
    await server.from('programme_requests').delete().eq('student_id', STUDENT_ID)
    await server.from('profiles').update({ programme_id: null }).eq('id', STUDENT_ID)
  })

  runCoursesAndClassesContract('Supabase', {
    create: () => ({
      courses: createSupabaseCourseService({ client: student }),
      classes: createSupabaseClassService({ client: student }),
    }),
  })

  runEnrolmentServiceContract('Supabase', {
    fixture: {
      open: CHM,
      upcoming: PHY,
      completed: CSC,
      archived: ENG,
      enrolled: MTH,
      alsoEnrolled: [SWE],
    },
    create: () => ({
      service: createSupabaseEnrolmentService({ client: student }),
      // The administrator's side: the function the console calls.
      decide: async (requestId, decision) => {
        const { error } = await admin.rpc('decide_enrollment_request', {
          p_request: requestId,
          p_decision: decision,
        })
        if (error) throw new Error(`Could not ${decision} the request`)
      },
    }),
  })

  runProgrammeContract('Supabase', {
    fixture: {
      open: PROG_OPEN,
      other: PROG_OTHER,
      closed: PROG_CLOSED,
      archived: PROG_ARCHIVED,
      // CHM 110, MTH 202 and PHY 101 are in use.
      openCodes: ['CHM 110', 'MTH 202', 'PHY 101'],
      // The student is already in MTH 202.
      newCourses: [CHM, PHY],
      completedCourse: CSC,
      archivedCourse: ENG,
    },
    create: () => ({
      service: createSupabaseEnrolmentService({ client: student }),
      // The administrator's side: the functions the console calls.
      decide: async (requestId, decision) => {
        const { error } = await admin.rpc('decide_programme_request', {
          p_request: requestId,
          p_decision: decision,
        })
        if (error) throw new Error(`Could not ${decision} the request`)
      },
      remove: async () => {
        const { error } = await admin.rpc('remove_from_programme', { p_student: STUDENT_ID })
        if (error) throw new Error('Could not remove the student from the programme')
      },
    }),
  })

  describe('programmes beyond the contract', () => {
    // Proves a student cannot read the tables behind the view, write a request or choose a
    // programme by writing their own profile: only an administrator's approval sets it.
    it('keeps the programme tables and the profile column out of a student’s reach', async () => {
      const table = await student.from('programmes').select('id')
      expect(table.data ?? []).toEqual([])

      const links = await student.from('programme_courses').select('course_id')
      expect(links.data ?? []).toEqual([])

      const own = await student
        .from('profiles')
        .update({ programme_id: PROG_OPEN })
        .eq('id', STUDENT_ID)
      expect(own.error).not.toBeNull()

      const forged = await student.from('programme_requests').insert({ programme_id: PROG_OPEN })
      expect(forged.error).not.toBeNull()

      // The old self-service function is gone.
      const selfJoin = await student.rpc('join_programme', { p_programme: PROG_OPEN })
      expect(selfJoin.error).not.toBeNull()
    })

    // Proves a student cannot approve their own request, and an administrator is not offered
    // programmes to join, and cannot ask.
    it('offers nothing to an administrator', async () => {
      const service = createSupabaseEnrolmentService({ client: admin })

      await expect(service.listJoinableProgrammes()).resolves.toEqual([])
      await expect(service.requestProgramme(PROG_OPEN)).rejects.toMatchObject({ kind: 'forbidden' })
    })

    it('refuses a student who tries to decide their own request', async () => {
      const service = createSupabaseEnrolmentService({ client: student })
      await service.requestProgramme(PROG_OPEN)
      const requestId = (await service.listJoinableProgrammes()).find(
        (p) => p.id === PROG_OPEN,
      )?.requestId

      const decided = await student.rpc('decide_programme_request', {
        p_request: requestId,
        p_decision: 'approved',
      })

      expect(decided.error).not.toBeNull()
    })
  })

  describe('beyond the contract', () => {
    // Proves the seed's numbers come through: teacher, students (the count Row Level Security
    // hides from the table) and classes.
    it('reads a course with its teacher and counts', async () => {
      const course = await createSupabaseCourseService({ client: student }).getCourse(MTH)

      expect(course).toMatchObject({
        code: 'MTH 202',
        teacher: { fullName: 'Sarah Mbarga' },
        studentCount: 2,
        classCount: 2,
        status: 'ongoing',
      })
    })

    // SECURITY: proves Row Level Security hides courses and classes the student is not in.
    it('hides a course the student is not in', async () => {
      const courses = createSupabaseCourseService({ client: student })
      const classes = createSupabaseClassService({ client: student })

      await expect(courses.getCourse(PHY)).rejects.toMatchObject({ kind: 'not_found' })
      await expect(classes.listClasses(PHY)).rejects.toMatchObject({ kind: 'not_found' })
      expect((await courses.listMyCourses()).map((c) => c.id).sort()).toEqual([MTH, SWE])
    })

    // SECURITY: proves a student never sees another student's requests (Tunde's are in the seed).
    it('does not show other students’ requests', async () => {
      const service = createSupabaseEnrolmentService({ client: student })

      await expect(service.listMyJoinRequests()).resolves.toEqual([])
    })

    // SECURITY: proves a student cannot ask on another student's behalf, or approve their own.
    it('refuses a request made for someone else and a self-approval', async () => {
      const forged = await student
        .from('enrollment_requests')
        .insert({ course_id: CHM, student_id: '10000000-0000-0000-0000-000000000005' })
      expect(forged.error).not.toBeNull()

      const own = await createSupabaseEnrolmentService({ client: student }).requestToJoin(CHM)
      const approve = await student
        .from('enrollment_requests')
        .update({ status: 'approved' })
        .eq('id', own.id)
      expect(approve.error).not.toBeNull()
      const decide = await student.rpc('decide_enrollment_request', {
        p_request: own.id,
        p_decision: 'approved',
      })
      expect(decide.error).not.toBeNull()
    })
  })
})
