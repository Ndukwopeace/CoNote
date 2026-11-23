/**
 * Tests for the demo AdminFormService (D126): the shared contract, plus what only the demo has: forms
 * and answers are saved after a change, and the seed holds a demo assessment with results.
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The records.
import { emptyPlatformData } from '../platformData'
// The shared rules.
import { describeFormServiceContract } from '../contracts/formService.contract'
// The demo seed.
import { createPlatformSeed } from './seed/platformSeed'

// The unit under test.
import { createMockFormService } from './mockFormService'

describeFormServiceContract('mock', {
  create: (data, now) => createMockFormService({ data, now: () => now, latencyMs: 0 }),
  respond: async (data, service, formId, answer) => {
    const form = await service.getForm(formId)
    const course = data.courses.find((candidate) => candidate.id === answer.courseId)
    const ratings = form.questions.filter((question) => question.kind === 'rating')
    const comment = form.questions.find((question) => question.kind === 'paragraph')
    data.formResponses.push({
      id: `response-${String(data.formResponses.length)}`,
      formId,
      // Each answer a second after the one before, so "newest first" is well defined.
      createdAt: new Date(Date.UTC(2026, 9, 8, 12, 0, data.formResponses.length)).toISOString(),
      courseCode: course?.code ?? null,
      lecturer: answer.lecturer,
      answers: {
        ...Object.fromEntries(
          ratings.map((question, index) => [question.id, answer.ratings[index] ?? 3]),
        ),
        ...(comment && answer.comment !== undefined ? { [comment.id]: answer.comment } : {}),
      },
    })
  },
})

describe('mock Form service', () => {
  // Proves a change is saved, so a reload keeps it.
  it('saves after a change', async () => {
    const onChange = vi.fn()
    const data = emptyPlatformData()
    const service = createMockFormService({ data, now: () => new Date(), latencyMs: 0, onChange })

    const id = await service.saveForm({
      title: 'T',
      description: '',
      accepting: false,
      opensAt: null,
      closesAt: null,
      questions: [],
    })
    await service.deleteForm(id)

    expect(onChange).toHaveBeenCalledTimes(2)
  })

  // Proves the demo seed holds an open assessment with answers for every lecturer the timetable names.
  it('starts with a demo assessment that has results', async () => {
    const data = createPlatformSeed(new Date())
    const service = createMockFormService({ data, now: () => new Date(), latencyMs: 0 })

    const [form] = await service.listForms()
    const summary = await service.getSummary(form?.id ?? '')

    expect(form).toMatchObject({ title: 'Lecturer assessment', state: 'open' })
    expect(summary.length).toBe(
      data.courses
        .filter((course) => course.archivedAt === null)
        .flatMap((course) => course.lecturers).length,
    )
    expect(
      summary.every((row) => row.responses > 0 && Object.keys(row.averages).length === 3),
    ).toBe(true)
  })
})
