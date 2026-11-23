/**
 * Tests for the Forms rules (D126): the template, the date input, the public link and the CSV, which must
 * not let a typed formula run in a spreadsheet.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import {
  TEMPLATE_QUESTIONS,
  fromLocalInput,
  publicFormPath,
  responsesToCsv,
  stateLabel,
  toLocalInput,
} from './forms'
// The question and answer shapes.
import type { FormQuestion } from '@conote/core/forms'
import type { FormResponseItem } from '@/types/forms'
import { formProblem } from '@conote/core/forms'

describe('TEMPLATE_QUESTIONS', () => {
  // Proves a new form starts from something the builder accepts, with one lecturer question first.
  it('is a valid form that starts with the lecturer question', () => {
    expect(TEMPLATE_QUESTIONS[0]?.kind).toBe('lecturer')
    expect(
      formProblem({ title: 'T', description: '', questions: [...TEMPLATE_QUESTIONS] }),
    ).toBeNull()
    expect(TEMPLATE_QUESTIONS.length).toBeLessThanOrEqual(8)
  })
})

describe('date inputs', () => {
  // Proves a time survives the trip into the input and back, and empty means no date.
  it('round-trips through the datetime-local input', () => {
    const iso = new Date(2026, 10, 20, 9, 30).toISOString()

    expect(toLocalInput(iso)).toBe('2026-11-20T09:30')
    expect(fromLocalInput('2026-11-20T09:30')).toBe(iso)
    expect(toLocalInput(null)).toBe('')
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('not a date')).toBeNull()
  })
})

describe('publicFormPath', () => {
  // Proves the link is the full address when the student site is known, and only the path otherwise.
  it('adds the student site address when there is one', () => {
    expect(publicFormPath('abc', 'https://conote.example')).toBe('https://conote.example/f/abc')
    expect(publicFormPath('abc', 'https://conote.example/')).toBe('https://conote.example/f/abc')
    expect(publicFormPath('abc')).toBe('/f/abc')
    expect(publicFormPath('abc', '')).toBe('/f/abc')
  })

  // SECURITY: proves the token cannot add path segments or a query to the link.
  it('encodes the token', () => {
    expect(publicFormPath('a/b?c=d')).toBe('/f/a%2Fb%3Fc%3Dd')
  })
})

describe('stateLabel', () => {
  it('names each state', () => {
    expect([stateLabel('open'), stateLabel('not_open'), stateLabel('closed')]).toEqual([
      'Open',
      'Opens later',
      'Closed',
    ])
  })
})

describe('responsesToCsv', () => {
  const questions: FormQuestion[] = [
    { id: 'l', kind: 'lecturer', prompt: 'Course and lecturer', required: true, options: [] },
    { id: 'r', kind: 'rating', prompt: 'Clear?', required: true, options: [] },
    { id: 'c', kind: 'paragraph', prompt: 'Comments', required: false, options: [] },
  ]
  /** One answer with the fields a test cares about overridden. */
  function answer(overrides: Partial<FormResponseItem>): FormResponseItem {
    return {
      id: 'a',
      createdAt: '2026-11-20T09:00:00.000Z',
      courseCode: 'MTH 202',
      lecturer: 'Dr. Smith',
      answers: { r: 5, c: 'Good' },
      ...overrides,
    }
  }

  // Proves the header and a row: the lecturer in its own columns, the others one column per question.
  it('writes a header and one row per answer', () => {
    const csv = responsesToCsv(questions, [answer({})])

    expect(csv).toBe(
      'Submitted,Course,Lecturer,Clear?,Comments\r\n2026-11-20T09:00:00.000Z,MTH 202,Dr. Smith,5,Good',
    )
  })

  // Proves a missing answer is an empty cell, and a form with no lecturer question has empty course cells.
  it('leaves a missing answer empty', () => {
    const csv = responsesToCsv(questions, [
      answer({ courseCode: null, lecturer: null, answers: { r: 3 } }),
    ])

    expect(csv.split('\r\n')[1]).toBe('2026-11-20T09:00:00.000Z,,,3,')
  })

  // Proves commas, quotes and line breaks are quoted so one answer stays in one cell.
  it('quotes cells that need it', () => {
    const csv = responsesToCsv(questions, [
      answer({ answers: { r: 4, c: 'Said "hi", then\nleft' } }),
    ])

    expect(csv).toContain('"Said ""hi"", then\nleft"')
  })

  // SECURITY: proves a comment that starts like a formula is made plain text, so opening the file in a
  // spreadsheet cannot run it.
  it('neutralises formulas', () => {
    const csv = responsesToCsv(questions, [
      answer({ answers: { r: 1, c: '=HYPERLINK("http://evil.example","x")' } }),
      answer({ answers: { r: 1, c: '+1+1' } }),
      answer({ answers: { r: 1, c: '@SUM(A1)' } }),
      answer({ answers: { r: 1, c: '-2+3' } }),
    ])
    const rows = csv.split('\r\n').slice(1)

    expect(rows[0]).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`)
    expect(rows[1]).toContain("'+1+1")
    expect(rows[2]).toContain("'@SUM(A1)")
    expect(rows[3]).toContain("'-2+3")
  })
})
