/**
 * The demo AdminFormService (D126): forms and their answers live in the demo platform and are saved
 * after every change. The rules match the database's: the limits, the lock on a form that has answers,
 * and the results by course and lecturer.
 */

// The rules, and the error type.
import { AppError } from '@conote/core/errors'
import { formProblem, type FormQuestion, type FormState } from '@conote/core/forms'

// The records it reads and writes.
import type { FormRecord, PlatformData } from '../platformData'
// The shapes it returns.
import {
  FORM_RESPONSES_PAGE_SIZE,
  type AdminForm,
  type AdminFormService,
  type FormListItem,
  type FormResultRow,
} from '@/types/forms'

// Fake network delay.
import { simulateLatency } from './latency'

/** What the demo service needs. */
interface MockFormOptions {
  data: PlatformData
  now: () => Date
  latencyMs: number
  // Called after a change, so the demo can save the platform.
  onChange?: () => void
}

/** A new secret for a public link: 32 characters, like the database's. */
function newToken(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

/** Whether a form takes answers at `now`: open, opening later, or closed. */
function stateOf(form: FormRecord, now: Date): FormState {
  if (!form.accepting) return 'closed'
  if (form.opensAt !== null && now.getTime() < Date.parse(form.opensAt)) return 'not_open'
  if (form.closesAt !== null && now.getTime() >= Date.parse(form.closesAt)) return 'closed'
  return 'open'
}

/** The average of `values`, to two places. */
function average(values: readonly number[]): number {
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
}

/** Builds the demo AdminFormService over `data`. */
export function createMockFormService({
  data,
  now,
  latencyMs,
  onChange,
}: MockFormOptions): AdminFormService {
  /** The form with this ID, or "not found". */
  function find(formId: string): FormRecord {
    const form = data.forms.find((candidate) => candidate.id === formId)
    if (!form) throw new AppError('not_found', 'We could not find that form.')
    return form
  }

  /** Every lecturer the timetable names, one entry per course and lecturer, in order. */
  function lecturerOptions() {
    return data.courses
      .filter((course) => course.archivedAt === null)
      .sort((a, b) => a.code.localeCompare(b.code))
      .flatMap((course) =>
        [...course.lecturers]
          .sort((a, b) => a.localeCompare(b))
          .map((lecturer) => ({
            courseId: course.id,
            courseCode: course.code,
            courseTitle: course.title,
            lecturer,
          })),
      )
  }

  return {
    async listForms() {
      await simulateLatency(latencyMs)
      return [...data.forms]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
        .map((form): FormListItem => ({
          id: form.id,
          token: form.token,
          title: form.title,
          accepting: form.accepting,
          opensAt: form.opensAt,
          closesAt: form.closesAt,
          createdAt: form.createdAt,
          state: stateOf(form, now()),
          questionCount: form.questions.length,
          responseCount: data.formResponses.filter((response) => response.formId === form.id)
            .length,
        }))
    },

    async getForm(formId) {
      await simulateLatency(latencyMs)
      const form = find(formId)
      return {
        id: form.id,
        token: form.token,
        title: form.title,
        description: form.description,
        accepting: form.accepting,
        opensAt: form.opensAt,
        closesAt: form.closesAt,
        state: stateOf(form, now()),
        responseCount: data.formResponses.filter((response) => response.formId === form.id).length,
        questions: form.questions.map((question) => ({ ...question })),
        lecturers: lecturerOptions(),
      } satisfies AdminForm
    },

    async saveForm(draft) {
      await simulateLatency(latencyMs)
      // The limits, with words the administrator can act on.
      const problem = formProblem(draft)
      if (problem !== null) throw new AppError('validation', problem)
      if (
        draft.opensAt !== null &&
        draft.closesAt !== null &&
        Date.parse(draft.closesAt) <= Date.parse(draft.opensAt)
      ) {
        throw new AppError('validation', 'A form must close after it opens.')
      }
      const existing = draft.id === undefined ? undefined : find(draft.id)
      const hasResponses =
        existing !== undefined &&
        data.formResponses.some((response) => response.formId === existing.id)
      // With answers on file, nothing may go and an answered question keeps its kind and choices.
      if (existing && hasResponses) {
        const kept = new Set(draft.questions.map((question) => question.id))
        if (existing.questions.some((question) => !kept.has(question.id))) {
          throw new AppError('validation', 'A question with answers cannot be removed.')
        }
        for (const question of draft.questions) {
          const before = existing.questions.find((candidate) => candidate.id === question.id)
          if (
            before &&
            (before.kind !== question.kind ||
              before.options.join('\n') !== question.options.map((o) => o.trim()).join('\n'))
          ) {
            throw new AppError('validation', 'An answered question keeps its kind and choices.')
          }
        }
      }
      // The questions, with an ID for each new one.
      const questions: FormQuestion[] = draft.questions.map((question) => {
        if (question.id !== undefined && !existing?.questions.some((q) => q.id === question.id)) {
          throw new AppError('validation', 'That question does not belong to this form.')
        }
        return {
          id: question.id ?? `question-${crypto.randomUUID()}`,
          kind: question.kind,
          prompt: question.prompt.trim(),
          required: question.required,
          options:
            question.kind === 'choice' || question.kind === 'dropdown'
              ? question.options.map((option) => option.trim()).filter((option) => option !== '')
              : [],
        }
      })
      const values = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        accepting: draft.accepting,
        opensAt: draft.opensAt,
        closesAt: draft.closesAt,
        questions,
      }
      if (existing) {
        Object.assign(existing, values)
        onChange?.()
        return existing.id
      }
      const created: FormRecord = {
        id: `form-${crypto.randomUUID()}`,
        token: newToken(),
        createdAt: now().toISOString(),
        ...values,
      }
      data.forms.push(created)
      onChange?.()
      return created.id
    },

    async deleteForm(formId) {
      await simulateLatency(latencyMs)
      const form = find(formId)
      data.forms.splice(data.forms.indexOf(form), 1)
      data.formResponses = data.formResponses.filter((response) => response.formId !== formId)
      onChange?.()
    },

    async getSummary(formId) {
      await simulateLatency(latencyMs)
      const form = find(formId)
      const responses = data.formResponses.filter((response) => response.formId === form.id)
      // One group per course and lecturer; a form with no such question has the one group of nulls.
      const groups = new Map<string, typeof responses>()
      for (const response of responses) {
        const key = `${response.courseCode ?? ''}\u0000${response.lecturer ?? ''}`
        groups.set(key, [...(groups.get(key) ?? []), response])
      }
      const ratings = form.questions.filter((question) => question.kind === 'rating')
      return [...groups.values()]
        .map((group): FormResultRow => {
          const averages: Record<string, number> = {}
          for (const question of ratings) {
            const given = group.flatMap((response) => {
              const value = response.answers[question.id]
              return typeof value === 'number' ? [value] : []
            })
            if (given.length > 0) averages[question.id] = average(given)
          }
          return {
            courseCode: group[0]?.courseCode ?? null,
            lecturer: group[0]?.lecturer ?? null,
            responses: group.length,
            averages,
          }
        })
        .sort(
          (a, b) =>
            (a.courseCode ?? '').localeCompare(b.courseCode ?? '') ||
            (a.lecturer ?? '').localeCompare(b.lecturer ?? ''),
        )
    },

    async listResponses(formId, filter) {
      await simulateLatency(latencyMs)
      const form = find(formId)
      const matches = data.formResponses
        .filter(
          (response) =>
            response.formId === form.id &&
            (filter.courseCode === undefined || response.courseCode === filter.courseCode) &&
            (filter.lecturer === undefined || response.lecturer === filter.lecturer),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      const offset = Math.max(filter.offset ?? 0, 0)
      return {
        items: matches.slice(offset, offset + FORM_RESPONSES_PAGE_SIZE).map((response) => ({
          id: response.id,
          createdAt: response.createdAt,
          courseCode: response.courseCode,
          lecturer: response.lecturer,
          answers: { ...response.answers },
        })),
        total: matches.length,
      }
    },

    async deleteResponse(responseId) {
      await simulateLatency(latencyMs)
      const index = data.formResponses.findIndex((response) => response.id === responseId)
      if (index === -1) throw new AppError('not_found', 'We could not find that response.')
      data.formResponses.splice(index, 1)
      onChange?.()
    },
  }
}
