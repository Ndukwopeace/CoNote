/**
 * Lecturer assessments built like a Google Form (D126): the kinds of question, the limits, how a form
 * and its answers are checked, and the service the public form page talks to. The database checks the
 * same rules again; this copy lets the pages say what is wrong without a round trip.
 */

/** The kinds of question, in the order the builder offers them. */
export const FORM_QUESTION_KINDS = [
  'lecturer',
  'short',
  'paragraph',
  'choice',
  'dropdown',
  'rating',
] as const

/** One kind of question. */
export type FormQuestionKind = (typeof FORM_QUESTION_KINDS)[number]

/** How each kind reads in the builder. */
export const FORM_KIND_LABELS: Readonly<Record<FormQuestionKind, string>> = {
  lecturer: 'Course and lecturer',
  short: 'Short answer',
  paragraph: 'Paragraph',
  choice: 'Multiple choice',
  dropdown: 'Dropdown',
  rating: 'Rating, 1 to 5',
}

/** The limits. The database refuses more. */
export const FORM_LIMITS = {
  questions: 40,
  title: 150,
  description: 2000,
  prompt: 300,
  option: 100,
  options: 20,
  short: 300,
  paragraph: 2000,
} as const

/** A question as the public page and the builder read it. */
export interface FormQuestion {
  id: string
  kind: FormQuestionKind
  prompt: string
  required: boolean
  // The choices, for "choice" and "dropdown"; empty for every other kind.
  options: string[]
}

/** A question in the builder: new ones have no ID yet. */
export interface FormQuestionDraft {
  id?: string | undefined
  kind: FormQuestionKind
  prompt: string
  required: boolean
  options: string[]
}

/** One choice in the "Course and lecturer" dropdown, from the timetable. */
export interface LecturerOption {
  courseId: string
  courseCode: string
  courseTitle: string
  lecturer: string
}

/** Whether a form is taking answers: open now, opening later, or closed. */
export type FormState = 'open' | 'not_open' | 'closed'

/** A form as the public page shows it. A form that is not open has no questions. */
export interface PublicForm {
  title: string
  description: string
  state: FormState
  questions: FormQuestion[]
  lecturers: LecturerOption[]
}

/** One answer: text, a choice, a rating, or a course with one of its lecturers. */
export type FormAnswer = string | number | { courseId: string; lecturer: string }

/** The answers by question ID. A question left out was not answered. */
export type FormAnswers = Record<string, FormAnswer | undefined>

/** What the public form page talks to. */
export interface PublicFormService {
  /** The form behind a link; rejects with not_found for an unknown link. */
  getForm(token: string): Promise<PublicForm>
  /** Sends one answer; rejects with validation for an unusable one or a form that is not open. */
  submit(token: string, answers: FormAnswers): Promise<void>
}

/** The value a lecturer dropdown option carries: the course and the name, joined. */
export function lecturerValue(option: Pick<LecturerOption, 'courseId' | 'lecturer'>): string {
  return `${option.courseId}::${option.lecturer}`
}

/** The choice a lecturer dropdown value stands for, or undefined when it is not on offer. */
export function lecturerFromValue(
  value: string,
  options: readonly LecturerOption[],
): LecturerOption | undefined {
  return options.find((option) => lecturerValue(option) === value)
}

/** Whether `value` is a whole number from 1 to 5. */
function isRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
}

/** What is wrong with one answer, in words, or null. A blank answer is fine here. */
function answerProblem(
  question: FormQuestion,
  answer: FormAnswer,
  lecturers: readonly LecturerOption[],
): string | null {
  const name = `"${question.prompt}"`
  switch (question.kind) {
    case 'short':
    case 'paragraph': {
      const limit = FORM_LIMITS[question.kind]
      if (typeof answer !== 'string') return `${name} needs text.`
      return answer.trim().length > limit
        ? `${name} must be under ${String(limit)} characters.`
        : null
    }
    case 'choice':
    case 'dropdown':
      return typeof answer === 'string' && question.options.includes(answer)
        ? null
        : `Choose one of the options for ${name}.`
    case 'rating':
      return isRating(answer) ? null : `Give ${name} a rating from 1 to 5.`
    case 'lecturer': {
      const found =
        typeof answer === 'object' &&
        lecturers.some(
          (option) => option.courseId === answer.courseId && option.lecturer === answer.lecturer,
        )
      return found ? null : `Choose a course and lecturer for ${name}.`
    }
  }
}

/**
 * The first thing wrong with `answers` for these questions, in words for the sender, or null when they
 * can be sent. A required question must be answered; every answer given must fit its question.
 */
export function answersProblem(
  questions: readonly FormQuestion[],
  lecturers: readonly LecturerOption[],
  answers: FormAnswers,
): string | null {
  for (const question of questions) {
    const answer = answers[question.id]
    // Not answered, or only spaces: fine unless the question is required.
    if (answer === undefined || (typeof answer === 'string' && answer.trim() === '')) {
      if (question.required) return `"${question.prompt}" needs an answer.`
      continue
    }
    const problem = answerProblem(question, answer, lecturers)
    if (problem !== null) return problem
  }
  return null
}

/** What is wrong with one question in the builder, in words, or null. */
export function questionProblem(question: Readonly<FormQuestionDraft>): string | null {
  const prompt = question.prompt.trim()
  if (prompt === '') return 'Every question needs some text.'
  if (prompt.length > FORM_LIMITS.prompt) {
    return `A question must be under ${String(FORM_LIMITS.prompt)} characters.`
  }
  if (question.kind !== 'choice' && question.kind !== 'dropdown') return null
  const options = question.options.map((option) => option.trim()).filter((option) => option !== '')
  if (options.length < 2) return `"${prompt}" needs at least two choices.`
  if (options.length > FORM_LIMITS.options) {
    return `"${prompt}" can have at most ${String(FORM_LIMITS.options)} choices.`
  }
  if (options.some((option) => option.length > FORM_LIMITS.option)) {
    return `A choice for "${prompt}" is too long.`
  }
  if (new Set(options).size !== options.length) return `The choices for "${prompt}" must differ.`
  return null
}

/** What is wrong with a form in the builder, in words, or null. */
export function formProblem(form: {
  title: string
  description: string
  questions: readonly FormQuestionDraft[]
}): string | null {
  const title = form.title.trim()
  if (title === '') return 'Give the form a title.'
  if (title.length > FORM_LIMITS.title) {
    return `The title must be under ${String(FORM_LIMITS.title)} characters.`
  }
  if (form.description.trim().length > FORM_LIMITS.description) {
    return `The description must be under ${String(FORM_LIMITS.description)} characters.`
  }
  if (form.questions.length > FORM_LIMITS.questions) {
    return `A form can have at most ${String(FORM_LIMITS.questions)} questions.`
  }
  if (form.questions.filter((question) => question.kind === 'lecturer').length > 1) {
    return 'A form can have only one "Course and lecturer" question.'
  }
  for (const question of form.questions) {
    const problem = questionProblem(question)
    if (problem !== null) return problem
  }
  return null
}
