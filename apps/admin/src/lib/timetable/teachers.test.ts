/**
 * Tests for matching the teacher names a timetable gives ("Dr TCHOKOTE") to teacher accounts (D105).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The function under test.
import { matchTeacher, suggestTeacher } from './teachers'

// The accounts an administrator has.
const accounts = [
  { id: 't1', fullName: 'Jean Paul Tchokote' },
  { id: 't2', fullName: 'Mary Zemagho' },
  { id: 't3', fullName: 'Peter Ndambomve' },
  { id: 't4', fullName: 'Grace Ndambomve' },
  { id: 't5', fullName: 'Sop Deffo Sevidzem' },
]

describe('matchTeacher', () => {
  // Proves a title and a surname match the one account with that surname.
  it('matches a surname after a title', () => {
    expect(matchTeacher('Dr TCHOKOTE', accounts)).toEqual({ kind: 'match', id: 't1' })
    expect(matchTeacher('Mr ZEMAGHO', accounts)).toEqual({ kind: 'match', id: 't2' })
  })

  // Proves letter case and accents do not matter.
  it('ignores case and accents', () => {
    expect(matchTeacher('MRS zemagho', [{ id: 'x', fullName: 'Mary Zémagho' }])).toEqual({
      kind: 'match',
      id: 'x',
    })
  })

  // Proves a longer name matches when every word of it is in the account's name.
  it('matches a name of several words', () => {
    expect(matchTeacher('Dr Sop Deffo SEVIDZEM', accounts)).toEqual({ kind: 'match', id: 't5' })
  })

  // Proves a surname two accounts share is reported as ambiguous, with both.
  it('reports a surname two accounts share', () => {
    expect(matchTeacher('Prof NDAMBOMVE', accounts)).toEqual({
      kind: 'ambiguous',
      ids: ['t3', 't4'],
    })
  })

  // Proves the first name narrows an otherwise shared surname.
  it('uses a first name to tell people apart', () => {
    expect(matchTeacher('Prof Peter NDAMBOMVE', accounts)).toEqual({ kind: 'match', id: 't3' })
  })

  // Proves every common title is dropped, with or without a full stop.
  it('drops titles', () => {
    for (const title of ['Dr.', 'Prof', 'Professor', 'Mr', 'Mrs', 'Ms', 'Mme', 'Eng', 'Engr']) {
      expect(matchTeacher(`${title} TCHOKOTE`, accounts)).toEqual({ kind: 'match', id: 't1' })
    }
  })

  // Proves a name that is not a person, or has no account, matches nothing.
  it('matches nothing for a group or an unknown person', () => {
    expect(matchTeacher('SIU Staff', accounts)).toEqual({ kind: 'none' })
    expect(matchTeacher('Year 3 Doers', accounts)).toEqual({ kind: 'none' })
    expect(matchTeacher('Dr UNKNOWN', accounts)).toEqual({ kind: 'none' })
  })

  // Proves a name that is only a title matches nothing, rather than everybody.
  it('matches nothing for a title alone', () => {
    expect(matchTeacher('Dr', accounts)).toEqual({ kind: 'none' })
  })

  // Proves an empty list of accounts matches nothing.
  it('matches nothing when there are no accounts', () => {
    expect(matchTeacher('Dr TCHOKOTE', [])).toEqual({ kind: 'none' })
  })
})

describe('suggestTeacher', () => {
  // Proves the first name that fits one account is the suggestion, with no note.
  it('suggests the first name that fits one account', () => {
    expect(suggestTeacher(['Dr TCHOKOTE'], accounts)).toEqual({ teacherId: 't1', notes: [] })
  })

  // Proves a name with no account gives no suggestion and a note naming it.
  it('notes a name with no account', () => {
    const suggestion = suggestTeacher(['Mr NOBODY'], accounts)

    expect(suggestion.teacherId).toBeNull()
    expect(suggestion.notes).toEqual(['No account fits "Mr NOBODY".'])
  })

  // Proves a name two accounts fit gives no suggestion and says so.
  it('notes a name that fits two accounts', () => {
    const suggestion = suggestTeacher(['Prof NDAMBOMVE'], accounts)

    expect(suggestion.teacherId).toBeNull()
    expect(suggestion.notes).toEqual(['More than one account fits "Prof NDAMBOMVE".'])
  })

  // Proves a later name that fits is used when an earlier one does not, and the earlier is noted.
  it('falls through to a later name that fits', () => {
    const suggestion = suggestTeacher(['Year 3 Doers', 'Dr TCHOKOTE'], accounts)

    expect(suggestion).toEqual({ teacherId: 't1', notes: ['No account fits "Year 3 Doers".'] })
  })

  // Proves a course with no teacher named has nothing to suggest and nothing to note.
  it('has nothing to say for a course with no teacher', () => {
    expect(suggestTeacher([], accounts)).toEqual({ teacherId: null, notes: [] })
  })
})
