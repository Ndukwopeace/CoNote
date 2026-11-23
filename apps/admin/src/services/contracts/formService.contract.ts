/**
 * The rules every AdminFormService must follow (D126), run against the demo and, in CI, the real
 * database: building and changing a form, the lock once it has answers, the lecturer choices from the
 * timetable, the results by course and lecturer, and reading and deleting answers. The real tables keep
 * what earlier runs made, so each test finds its own form by a title nobody else uses.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The records a test starts from.
import { courseRecord, emptyPlatformData, type PlatformData } from '../platformData'
// The interface under test, and the shapes it takes.
import type { FormQuestionDraft } from '@conote/core/forms'
import type { AdminFormService, FormDraft } from '@/types/forms'

/** One answer a contract test sends as a visitor would. */
export interface ContractAnswer {
  // The platform's ID for the course answered about, and the lecturer.
  courseId: string
  lecturer: string
  // One rating per rating question, in the form's order.
  ratings: number[]
  comment?: string
}

/** What each implementation's test file passes in. */
export interface FormContractEnv {
  // Builds a service over `data`, signed in as an administrator.
  create: (data: PlatformData, now: Date) => AdminFormService
  // Sends one answer to a form the way a visitor does: the demo adds a record; the database is asked.
  respond: (
    data: PlatformData,
    service: AdminFormService,
    formId: string,
    answer: ContractAnswer,
  ) => Promise<void>
}

/** The clock the contract uses. */
const NOW = new Date(2026, 9, 8, 12)

/** A platform with one course whose timetable names two lecturers, one of them also on a second course. */
function platform(): PlatformData {
  return emptyPlatformData({
    courses: [
      courseRecord({
        id: 'c1',
        code: 'MTH 202',
        title: 'Linear Algebra',
        lecturers: ['Dr. Smith', 'Dr. Jones'],
      }),
      courseRecord({ id: 'c2', code: 'PHY 101', title: 'Physics', lecturers: ['Dr. Smith'] }),
      courseRecord({
        id: 'c3',
        code: 'OLD 100',
        title: 'Old',
        lecturers: ['Dr. Gone'],
        archivedAt: '2026-01-01T00:00:00.000Z',
      }),
    ],
  })
}

/** A title nobody else uses, so a test can find its own form. */
function uniqueTitle(label: string) {
  return `${label} ${String(Date.now())}-${String(Math.random()).slice(2, 8)}`
}

/** The questions of a typical assessment. */
const QUESTIONS: FormQuestionDraft[] = [
  { kind: 'lecturer', prompt: 'Course and lecturer', required: true, options: [] },
  { kind: 'rating', prompt: 'Explains clearly', required: true, options: [] },
  { kind: 'rating', prompt: 'Is prepared', required: false, options: [] },
  { kind: 'choice', prompt: 'Starts on time?', required: false, options: ['Always', 'Sometimes'] },
  { kind: 'paragraph', prompt: 'What could improve?', required: false, options: [] },
]

/** A draft with the fields a test cares about overridden. */
function draft(title: string, overrides: Partial<FormDraft> = {}): FormDraft {
  return {
    title,
    description: 'Rate one course at a time.',
    accepting: false,
    opensAt: null,
    closesAt: null,
    questions: QUESTIONS.map((question) => ({ ...question })),
    ...overrides,
  }
}

/** Builds a form and returns the service, the platform it runs on and the saved form's ID. */
async function buildForm(env: FormContractEnv, overrides: Partial<FormDraft>) {
  const data = platform()
  const service = env.create(data, NOW)
  const title = uniqueTitle('Assessment')
  const id = await service.saveForm(draft(title, overrides))
  return { data, service, id, title }
}

/** Registers the AdminFormService contract suite under `name`. */
export function describeFormServiceContract(name: string, env: FormContractEnv) {
  describe(`AdminFormService contract: ${name}`, () => {
    // Builds a form on this environment and returns the service, the platform and the saved form's ID.
    const built = (overrides: Partial<FormDraft> = {}) => buildForm(env, overrides)

    // Proves a form is saved with its questions in order, closed until switched on, and listed.
    it('saves a form and reads it back, closed at first', async () => {
      const { service, id, title } = await built()

      const form = await service.getForm(id)
      const listed = (await service.listForms()).find((item) => item.id === id)

      expect(form).toMatchObject({
        title,
        description: 'Rate one course at a time.',
        state: 'closed',
        responseCount: 0,
      })
      expect(form.questions.map((question) => question.kind)).toEqual(
        QUESTIONS.map((question) => question.kind),
      )
      expect(form.questions[3]?.options).toEqual(['Always', 'Sometimes'])
      expect(form.token.length).toBeGreaterThanOrEqual(32)
      expect(listed).toMatchObject({ title, questionCount: 5, responseCount: 0, state: 'closed' })
    })

    // Proves the state follows the switch and the dates.
    it('is open when switched on, and not open before its date', async () => {
      // One service for all three forms: a real stack starts a fresh session for each service it makes.
      const { service, id: openId } = await built({ accepting: true })
      const laterId = await service.saveForm(
        draft(uniqueTitle('Later'), { accepting: true, opensAt: '2099-01-01T00:00:00.000Z' }),
      )
      const pastId = await service.saveForm(
        draft(uniqueTitle('Past'), { accepting: true, closesAt: '2000-01-01T00:00:00.000Z' }),
      )

      expect((await service.getForm(openId)).state).toBe('open')
      expect((await service.getForm(laterId)).state).toBe('not_open')
      expect((await service.getForm(pastId)).state).toBe('closed')
    })

    // Proves the builder's limits are enforced by the service too.
    it('refuses a form that breaks a rule', async () => {
      const service = env.create(platform(), NOW)
      const title = uniqueTitle('Bad')
      const lecturer: FormQuestionDraft = {
        kind: 'lecturer',
        prompt: 'Who?',
        required: true,
        options: [],
      }

      await expect(service.saveForm(draft(' '))).rejects.toMatchObject({ kind: 'validation' })
      await expect(
        service.saveForm(draft(title, { questions: [lecturer, lecturer] })),
      ).rejects.toMatchObject({ kind: 'validation' })
      await expect(
        service.saveForm(
          draft(title, {
            questions: [{ kind: 'choice', prompt: 'Pick', required: false, options: ['Only'] }],
          }),
        ),
      ).rejects.toMatchObject({ kind: 'validation' })
      await expect(
        service.saveForm(
          draft(title, {
            opensAt: '2030-01-02T00:00:00.000Z',
            closesAt: '2030-01-01T00:00:00.000Z',
          }),
        ),
      ).rejects.toMatchObject({ kind: 'validation' })
    })

    // Proves the lecturer choices come from the timetable, for courses in use only.
    it('offers the lecturers the timetable names, for courses in use', async () => {
      const { service, id } = await built()

      const { lecturers } = await service.getForm(id)

      expect(lecturers.map((option) => `${option.courseCode} ${option.lecturer}`)).toEqual([
        'MTH 202 Dr. Jones',
        'MTH 202 Dr. Smith',
        'PHY 101 Dr. Smith',
      ])
    })

    // Proves an existing form can be changed: reworded, a question added, reordered.
    it('changes a form and keeps its questions by ID', async () => {
      const { service, id } = await built()
      const before = await service.getForm(id)

      await service.saveForm({
        id,
        title: before.title,
        description: 'New words',
        accepting: true,
        opensAt: null,
        closesAt: null,
        questions: [
          ...before.questions.map((question) => ({ ...question })).reverse(),
          { kind: 'short', prompt: 'Your level', required: false, options: [] },
        ],
      })
      const after = await service.getForm(id)

      expect(after.description).toBe('New words')
      expect(after.state).toBe('open')
      expect(after.questions).toHaveLength(6)
      expect(after.questions[0]?.id).toBe(before.questions[4]?.id)
      expect(after.questions.at(-1)?.prompt).toBe('Your level')
    })

    // Proves the results: averages per lecturer and course, and the answers listed newest first.
    it('summarises answers by course and lecturer', async () => {
      const { data, service, id } = await built({ accepting: true })
      const form = await service.getForm(id)
      const [first, second] = form.questions.filter((question) => question.kind === 'rating')
      await env.respond(data, service, id, {
        courseId: 'c1',
        lecturer: 'Dr. Smith',
        ratings: [5, 4],
        comment: 'Great',
      })
      await env.respond(data, service, id, {
        courseId: 'c1',
        lecturer: 'Dr. Smith',
        ratings: [3, 2],
      })
      await env.respond(data, service, id, {
        courseId: 'c1',
        lecturer: 'Dr. Jones',
        ratings: [1, 1],
      })

      const summary = await service.getSummary(id)

      expect(
        summary.map((row) => `${row.courseCode} ${row.lecturer} ${String(row.responses)}`),
      ).toEqual(['MTH 202 Dr. Jones 1', 'MTH 202 Dr. Smith 2'])
      const smith = summary.find((row) => row.lecturer === 'Dr. Smith')
      expect(smith?.averages[first?.id ?? '']).toBe(4)
      expect(smith?.averages[second?.id ?? '']).toBe(3)
      expect((await service.getForm(id)).responseCount).toBe(3)
      expect((await service.listForms()).find((item) => item.id === id)?.responseCount).toBe(3)
    })

    // Proves answers are listed newest first, narrowed by lecturer, paged with the total kept.
    it('lists answers, narrows them and keeps the total past the end', async () => {
      const { data, service, id } = await built({ accepting: true })
      await env.respond(data, service, id, {
        courseId: 'c1',
        lecturer: 'Dr. Smith',
        ratings: [5, 5],
        comment: 'First',
      })
      await env.respond(data, service, id, {
        courseId: 'c1',
        lecturer: 'Dr. Jones',
        ratings: [2, 2],
        comment: 'Second',
      })
      const comment =
        (await service.getForm(id)).questions.find((question) => question.kind === 'paragraph')
          ?.id ?? ''

      const all = await service.listResponses(id, {})
      const jones = await service.listResponses(id, {
        courseCode: 'MTH 202',
        lecturer: 'Dr. Jones',
      })
      const beyond = await service.listResponses(id, { offset: 1000 })

      expect(all.total).toBe(2)
      expect(all.items.map((item) => item.answers[comment])).toEqual(['Second', 'First'])
      expect(all.items[0]).toMatchObject({ courseCode: 'MTH 202', lecturer: 'Dr. Jones' })
      expect(jones.items).toHaveLength(1)
      expect(jones.total).toBe(1)
      expect(beyond.items).toHaveLength(0)
      expect(beyond.total).toBe(2)
    })

    // Proves answers keep the results whole: nothing may be removed, and an answered question keeps its kind.
    it('locks the questions once there are answers', async () => {
      const { data, service, id } = await built({ accepting: true })
      await env.respond(data, service, id, {
        courseId: 'c1',
        lecturer: 'Dr. Smith',
        ratings: [5, 5],
      })
      const form = await service.getForm(id)
      const keep = (questions: FormQuestionDraft[]): FormDraft => ({
        id,
        title: form.title,
        description: form.description,
        accepting: true,
        opensAt: null,
        closesAt: null,
        questions,
      })

      await expect(service.saveForm(keep(form.questions.slice(1)))).rejects.toMatchObject({
        kind: 'validation',
      })
      await expect(
        service.saveForm(
          keep(form.questions.map((q, i) => (i === 1 ? { ...q, kind: 'paragraph' as const } : q))),
        ),
      ).rejects.toMatchObject({ kind: 'validation' })
      // Rewording and adding a question are fine.
      await service.saveForm(
        keep([
          ...form.questions.map((q, i) =>
            i === 1 ? { ...q, prompt: 'Explains very clearly' } : q,
          ),
          { kind: 'short', prompt: 'Anything else?', required: false, options: [] },
        ]),
      )
      expect((await service.getForm(id)).questions).toHaveLength(6)
    })

    // Proves one answer can be deleted, and an unknown one is "not found".
    it('deletes an answer', async () => {
      const { data, service, id } = await built({ accepting: true })
      await env.respond(data, service, id, {
        courseId: 'c1',
        lecturer: 'Dr. Smith',
        ratings: [5, 5],
      })
      const answer = (await service.listResponses(id, {})).items[0]

      await service.deleteResponse(answer?.id ?? '')

      expect((await service.listResponses(id, {})).total).toBe(0)
      await expect(
        service.deleteResponse('00000000-0000-0000-0000-00000000dead'),
      ).rejects.toMatchObject({ kind: 'not_found' })
    })

    // Proves a form is deleted with its answers, and an unknown or malformed ID is "not found".
    it('deletes a form and answers not found for an unknown one', async () => {
      const { data, service, id } = await built({ accepting: true })
      await env.respond(data, service, id, {
        courseId: 'c1',
        lecturer: 'Dr. Smith',
        ratings: [5, 5],
      })

      await service.deleteForm(id)

      expect((await service.listForms()).some((item) => item.id === id)).toBe(false)
      await expect(service.getForm(id)).rejects.toMatchObject({ kind: 'not_found' })
      await expect(service.getForm('nope')).rejects.toMatchObject({ kind: 'not_found' })
      await expect(
        service.deleteForm('00000000-0000-0000-0000-00000000dead'),
      ).rejects.toMatchObject({ kind: 'not_found' })
    })
  })
}
