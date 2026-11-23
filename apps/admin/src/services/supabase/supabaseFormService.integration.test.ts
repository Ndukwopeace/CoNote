/**
 * Runs the shared AdminFormService contract against a real Supabase stack, so a form is built, answered
 * through the public function, and read back exactly as the demo does it. Skipped unless
 * VITE_SUPABASE_TEST_* variables point at a stack. NEVER point it at a hosted project.
 */

// Vitest building blocks.
import { beforeAll, describe } from 'vitest'

// The shared contract every AdminFormService must meet.
import { describeFormServiceContract } from '../contracts/formService.contract'

// The harness that loads a platform and translates IDs.
import { CONFIGURED, HARNESS_ADMIN, Harness, withAdmin } from './integrationSupport'
// The implementation under test.
import { createSupabaseAdminFormService } from './supabaseFormService'

describe.skipIf(!CONFIGURED)('Supabase form service', () => {
  // Built when the suite starts, because a skipped suite still runs this body once.
  let harness: Harness
  beforeAll(() => {
    harness = new Harness({ freshAccounts: true })
  })

  describeFormServiceContract('Supabase', {
    create: (data) =>
      harness.wrap(withAdmin(data), HARNESS_ADMIN.id, (client) =>
        createSupabaseAdminFormService({ client }),
      ),
    // A visitor's answer goes through the public function. The course's stack ID and the question IDs
    // are what the function expects, so the answer is built from the form as it is stored.
    respond: async (_data, service, formId, answer) => {
      const form = await service.getForm(formId)
      const option = form.lecturers.find(
        (candidate) =>
          candidate.courseId === answer.courseId && candidate.lecturer === answer.lecturer,
      )
      const lecturer = form.questions.find((question) => question.kind === 'lecturer')
      const ratings = form.questions.filter((question) => question.kind === 'rating')
      const comment = form.questions.find((question) => question.kind === 'paragraph')
      await harness.submitFormAnswer(form.token, {
        ...(lecturer && option
          ? {
              [lecturer.id]: {
                courseId: harness.ids.down(option.courseId),
                lecturer: option.lecturer,
              },
            }
          : {}),
        ...Object.fromEntries(
          ratings.map((question, index) => [question.id, answer.ratings[index] ?? 3]),
        ),
        ...(comment && answer.comment !== undefined ? { [comment.id]: answer.comment } : {}),
      })
    },
  })
})
