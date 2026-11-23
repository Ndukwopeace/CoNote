/**
 * The demo PublicFormService (D126): one form at the link /f/demo, so the page can be tried without a
 * database. Answers are checked like the real service checks them and then dropped.
 */

// The error type, and the form rules.
import { AppError } from '@conote/core/errors'
import { answersProblem, type PublicForm, type PublicFormService } from '@conote/core/forms'

/** The link that opens the demo form. */
export const DEMO_FORM_TOKEN = 'demo'

/** The demo form: a course and lecturer, three ratings, and a comment. */
const DEMO_FORM: PublicForm = {
  title: 'Lecturer assessment (demo)',
  description:
    'Rate one course at a time. Your answers are anonymous. To rate another course, choose "Submit another response" after you send this one.',
  state: 'open',
  questions: [
    {
      id: 'q-lecturer',
      kind: 'lecturer',
      prompt: 'Course and lecturer',
      required: true,
      options: [],
    },
    {
      id: 'q-clear',
      kind: 'rating',
      prompt: 'Explains the material clearly',
      required: true,
      options: [],
    },
    {
      id: 'q-ready',
      kind: 'rating',
      prompt: 'Is prepared for classes',
      required: true,
      options: [],
    },
    {
      id: 'q-time',
      kind: 'choice',
      prompt: 'Starts and ends on time',
      required: false,
      options: ['Always', 'Usually', 'Rarely'],
    },
    {
      id: 'q-comment',
      kind: 'paragraph',
      prompt: 'What could improve?',
      required: false,
      options: [],
    },
  ],
  lecturers: [
    {
      courseId: 'demo-mth',
      courseCode: 'MTH 202',
      courseTitle: 'Linear Algebra',
      lecturer: 'Dr. A. Smith',
    },
    {
      courseId: 'demo-swe',
      courseCode: 'SWE 311',
      courseTitle: 'Software Engineering',
      lecturer: 'Dr. B. Jones',
    },
    {
      courseId: 'demo-swe',
      courseCode: 'SWE 311',
      courseTitle: 'Software Engineering',
      lecturer: 'Prof. C. Ade',
    },
  ],
}

/** Builds the demo PublicFormService, with a delay like a network call. */
export function createMockPublicFormService(latencyMs: number): PublicFormService {
  /** Waits like a network call. */
  const wait = () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, latencyMs)
    })
  return {
    async getForm(token) {
      await wait()
      if (token !== DEMO_FORM_TOKEN) throw new AppError('not_found', 'We could not find that form.')
      return DEMO_FORM
    },

    async submit(token, answers) {
      await wait()
      if (token !== DEMO_FORM_TOKEN) throw new AppError('not_found', 'We could not find that form.')
      // An unusable answer is refused as the database would refuse it.
      const problem = answersProblem(DEMO_FORM.questions, DEMO_FORM.lecturers, answers)
      if (problem !== null) throw new AppError('validation', problem)
    },
  }
}
