/**
 * Tests for the form rules (D126): which answers fit a form's questions, and which forms and
 * questions the builder accepts.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import {
  FORM_LIMITS,
  answersProblem,
  formProblem,
  lecturerFromValue,
  lecturerValue,
  questionProblem,
  type FormQuestion,
  type FormQuestionDraft,
  type LecturerOption,
} from './forms'

/** A question with the fields a test cares about overridden. */
function question(overrides: Partial<FormQuestion> & { id: string }): FormQuestion {
  return { kind: 'short', prompt: 'Name?', required: false, options: [], ...overrides }
}

const LECTURERS: LecturerOption[] = [
  { courseId: 'c1', courseCode: 'MTH 202', courseTitle: 'Linear Algebra', lecturer: 'Dr. Smith' },
]

describe('answersProblem', () => {
  // Proves a required question left blank, or with only spaces, is named in the message.
  it('asks for a required answer', () => {
    const questions = [question({ id: 'q1', prompt: 'Why?', required: true })]

    expect(answersProblem(questions, [], {})).toBe('"Why?" needs an answer.')
    expect(answersProblem(questions, [], { q1: '   ' })).toBe('"Why?" needs an answer.')
    expect(answersProblem(questions, [], { q1: 'Because' })).toBeNull()
  })

  // Proves a question that is not required may be left out.
  it('lets an optional question go unanswered', () => {
    expect(answersProblem([question({ id: 'q1' })], [], {})).toBeNull()
  })

  // Proves ratings are whole numbers from 1 to 5 and nothing else.
  it('accepts ratings from 1 to 5 only', () => {
    const questions = [question({ id: 'r', kind: 'rating', prompt: 'Clear?' })]

    expect(answersProblem(questions, [], { r: 5 })).toBeNull()
    expect(answersProblem(questions, [], { r: 1 })).toBeNull()
    expect(answersProblem(questions, [], { r: 6 })).toMatch(/rating from 1 to 5/)
    expect(answersProblem(questions, [], { r: 0 })).toMatch(/rating from 1 to 5/)
    expect(answersProblem(questions, [], { r: 3.5 })).toMatch(/rating from 1 to 5/)
    expect(answersProblem(questions, [], { r: '4' })).toMatch(/rating from 1 to 5/)
  })

  // Proves a choice must be one of the options.
  it('accepts only a choice that is on offer', () => {
    const questions = [
      question({ id: 'c', kind: 'choice', prompt: 'On time?', options: ['Yes', 'No'] }),
    ]

    expect(answersProblem(questions, [], { c: 'Yes' })).toBeNull()
    expect(answersProblem(questions, [], { c: 'Maybe' })).toMatch(/Choose one of the options/)
  })

  // Proves text answers are cut at their limits.
  it('limits the length of text answers', () => {
    const short = [question({ id: 's' })]
    const paragraph = [question({ id: 'p', kind: 'paragraph' })]

    expect(answersProblem(short, [], { s: 'x'.repeat(FORM_LIMITS.short) })).toBeNull()
    expect(answersProblem(short, [], { s: 'x'.repeat(FORM_LIMITS.short + 1) })).toMatch(/under 300/)
    expect(answersProblem(paragraph, [], { p: 'x'.repeat(FORM_LIMITS.paragraph) })).toBeNull()
    expect(answersProblem(paragraph, [], { p: 'x'.repeat(FORM_LIMITS.paragraph + 1) })).toMatch(
      /under 2000/,
    )
  })

  // Proves the lecturer must be one the timetable names for that course.
  it('accepts only a lecturer the timetable names', () => {
    const questions = [question({ id: 'l', kind: 'lecturer', prompt: 'Who?', required: true })]

    expect(
      answersProblem(questions, LECTURERS, { l: { courseId: 'c1', lecturer: 'Dr. Smith' } }),
    ).toBeNull()
    expect(
      answersProblem(questions, LECTURERS, { l: { courseId: 'c1', lecturer: 'Dr. Nobody' } }),
    ).toMatch(/Choose a course and lecturer/)
    expect(
      answersProblem(questions, LECTURERS, { l: { courseId: 'c2', lecturer: 'Dr. Smith' } }),
    ).toMatch(/Choose a course and lecturer/)
  })
})

describe('lecturer values', () => {
  // Proves a dropdown value turns back into the option it came from, and an unknown one into nothing.
  it('round-trips an option through its value', () => {
    const option = LECTURERS[0]!

    expect(lecturerFromValue(lecturerValue(option), LECTURERS)).toBe(option)
    expect(lecturerFromValue('c9::Someone', LECTURERS)).toBeUndefined()
  })
})

describe('questionProblem', () => {
  /** A draft with the fields a test cares about overridden. */
  function draft(overrides: Partial<FormQuestionDraft>): FormQuestionDraft {
    return { kind: 'short', prompt: 'Name?', required: false, options: [], ...overrides }
  }

  // Proves empty and over-long questions are turned away.
  it('needs text of a sane length', () => {
    expect(questionProblem(draft({ prompt: '  ' }))).toBe('Every question needs some text.')
    expect(questionProblem(draft({ prompt: 'x'.repeat(FORM_LIMITS.prompt + 1) }))).toMatch(
      /under 300/,
    )
    expect(questionProblem(draft({}))).toBeNull()
  })

  // Proves choice questions need two or more different choices within the limits.
  it('checks the choices of a choice question', () => {
    expect(questionProblem(draft({ kind: 'choice', options: ['Only'] }))).toMatch(/at least two/)
    expect(questionProblem(draft({ kind: 'choice', options: ['A', 'A'] }))).toMatch(/must differ/)
    expect(questionProblem(draft({ kind: 'dropdown', options: ['A', ' ', 'B'] }))).toBeNull()
    expect(
      questionProblem(
        draft({ kind: 'choice', options: ['A', 'x'.repeat(FORM_LIMITS.option + 1)] }),
      ),
    ).toMatch(/too long/)
    expect(
      questionProblem(
        draft({
          kind: 'choice',
          options: Array.from(
            { length: FORM_LIMITS.options + 1 },
            (_unused, i) => `Option ${String(i)}`,
          ),
        }),
      ),
    ).toMatch(/at most 20/)
  })
})

describe('formProblem', () => {
  /** A valid form to change one thing in. */
  const base = { title: 'Assessment', description: '', questions: [] as FormQuestionDraft[] }

  // Proves the title is required and limited, and the form passes when it is fine.
  it('needs a title', () => {
    expect(formProblem({ ...base, title: ' ' })).toBe('Give the form a title.')
    expect(formProblem({ ...base, title: 'x'.repeat(FORM_LIMITS.title + 1) })).toMatch(/under 150/)
    expect(formProblem(base)).toBeNull()
  })

  // Proves a form has at most one lecturer question and at most 40 questions.
  it('limits the questions', () => {
    const lecturer: FormQuestionDraft = {
      kind: 'lecturer',
      prompt: 'Who?',
      required: true,
      options: [],
    }
    expect(formProblem({ ...base, questions: [lecturer, lecturer] })).toMatch(/only one/)
    const many = Array.from({ length: FORM_LIMITS.questions + 1 }, () => ({
      kind: 'short' as const,
      prompt: 'Q',
      required: false,
      options: [],
    }))
    expect(formProblem({ ...base, questions: many })).toMatch(/at most 40/)
  })

  // Proves a bad question stops the whole form.
  it('reports the first bad question', () => {
    const bad: FormQuestionDraft = { kind: 'short', prompt: '', required: false, options: [] }
    expect(formProblem({ ...base, questions: [bad] })).toBe('Every question needs some text.')
  })
})
