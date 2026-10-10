/**
 * Runs the course, class and enrolment contracts against a real Supabase project, plus the checks
 * only a real database can answer (Row Level Security hiding other courses). It needs the seed
 * from supabase/seed.sql and is skipped unless VITE_SUPABASE_TEST_* variables point at a project,
 * so `npm test` never touches the network. CI starts a local Supabase stack and sets them (see
 * the "Supabase contract tests" job). NEVER point it at a hosted project: it deletes requests.
 */

// The client used to reset data as the server.
import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js'
// Vitest building blocks.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// The shared contracts every implementation must meet.
import { runCoursesAndClassesContract } from '../contracts/coursesAndClasses.contract'
import { runEnrolmentServiceContract } from '../contracts/enrolmentService.contract'

// The implementations under test.
import { createSupabaseClassService } from './supabaseClassService'
import { createSupabaseCourseService } from './supabaseCourseService'
import { createSupabaseEnrolmentService } from './supabaseEnrolmentService'

/** A setting from the environment, or undefined when it is missing or empty. */
function setting(name: string): string | undefined {
  // Vitest exposes only VITE_-prefixed variables to tests.
  const value: unknown = import.meta.env[name]
  return typeof value === 'string' && value !== '' ? value : undefined
}

// The project to test against, and the demo accounts the seed creates.
const URL = setting('VITE_SUPABASE_TEST_URL')
const ANON_KEY = setting('VITE_SUPABASE_TEST_ANON_KEY')
const SERVICE_KEY = setting('VITE_SUPABASE_TEST_SERVICE_KEY')
const EMAIL = setting('VITE_SUPABASE_TEST_EMAIL')
const PASSWORD = setting('VITE_SUPABASE_TEST_PASSWORD')
const ADMIN_EMAIL = setting('VITE_SUPABASE_TEST_ADMIN_EMAIL')

// The seed's IDs (supabase/seed.sql).
const STUDENT_ID = '10000000-0000-0000-0000-000000000004'
const MTH = '20000000-0000-0000-0000-000000000001'
const SWE = '20000000-0000-0000-0000-000000000002'
const PHY = '20000000-0000-0000-0000-000000000003'
const CHM = '20000000-0000-0000-0000-000000000004'
const CSC = '20000000-0000-0000-0000-000000000005'
const ENG = '20000000-0000-0000-0000-000000000006'

/** Storage that lives only in memory, so tests never touch the browser's. */
function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
    removeItem: (key: string) => {
      items.delete(key)
    },
  }
}

/** A client signed in as `email`. */
async function signedIn(email: string, storageKey: string): Promise<SupabaseClient> {
  // Memory storage keeps the session out of the browser's; no refresh timer is needed.
  const options: SupabaseClientOptions<'public'> = {
    auth: { storage: memoryStorage(), storageKey, autoRefreshToken: false },
  }
  const client = createClient(URL ?? '', ANON_KEY ?? '', options)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD ?? '' })
  if (error) throw new Error(`Could not sign in as ${email}`)
  return client
}

/** A client with the server key, which bypasses Row Level Security. Used only to reset data. */
function serverClient(): SupabaseClient {
  const options: SupabaseClientOptions<'public'> = { auth: { persistSession: false } }
  const client = createClient(URL ?? '', SERVICE_KEY ?? '', options)
  return client
}

describe.skipIf(!URL || !ANON_KEY || !SERVICE_KEY || !EMAIL || !PASSWORD || !ADMIN_EMAIL)(
  'Supabase course services',
  () => {
    // The signed-in student, the signed-in administrator, and the server (which bypasses RLS).
    let student: SupabaseClient
    let admin: SupabaseClient
    let server: SupabaseClient

    beforeAll(async () => {
      student = await signedIn(EMAIL ?? '', 'conote-test-student')
      admin = await signedIn(ADMIN_EMAIL ?? '', 'conote-test-admin')
      server = serverClient()
    })

    afterAll(async () => {
      await student.auth.signOut()
      await admin.auth.signOut()
    })

    // Every test starts as the seed leaves the student: no requests, and not in the open course.
    beforeEach(async () => {
      await server.from('enrollment_requests').delete().eq('student_id', STUDENT_ID)
      await server.from('enrollments').delete().eq('student_id', STUDENT_ID).eq('course_id', CHM)
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
  },
)
