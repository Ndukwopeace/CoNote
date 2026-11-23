/**
 * Tests for the demo PublicFormService (D126): the demo form opens at its link, an unknown link is not
 * found, and an answer is checked like the real service checks it.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { DEMO_FORM_TOKEN, createMockPublicFormService } from './mockPublicFormService'

describe('mock public form service', () => {
  const service = createMockPublicFormService(0)

  // Proves the demo link opens an open form with its questions and lecturer choices.
  it('opens the demo form at its link', async () => {
    const form = await service.getForm(DEMO_FORM_TOKEN)

    expect(form.state).toBe('open')
    expect(form.questions.length).toBeGreaterThan(0)
    expect(form.lecturers.length).toBeGreaterThan(0)
  })

  // Proves any other link is "not found".
  it('answers not found for another link', async () => {
    await expect(service.getForm('other')).rejects.toMatchObject({ kind: 'not_found' })
    await expect(service.submit('other', {})).rejects.toMatchObject({ kind: 'not_found' })
  })

  // Proves a complete answer is accepted and an incomplete one is refused with words.
  it('accepts a complete answer and refuses an incomplete one', async () => {
    const form = await service.getForm(DEMO_FORM_TOKEN)
    const first = form.lecturers[0]!
    const lecturer = form.questions.find((question) => question.kind === 'lecturer')!
    const ratings = form.questions.filter((question) => question.kind === 'rating')
    const answers = {
      [lecturer.id]: { courseId: first.courseId, lecturer: first.lecturer },
      ...Object.fromEntries(ratings.map((question) => [question.id, 4])),
    }

    await expect(service.submit(DEMO_FORM_TOKEN, answers)).resolves.toBeUndefined()
    await expect(service.submit(DEMO_FORM_TOKEN, {})).rejects.toMatchObject({ kind: 'validation' })
    await expect(service.submit(DEMO_FORM_TOKEN, {})).rejects.toThrow(/needs an answer/)
  })
})
