/**
 * Tests for the note rules shared by the form and the note service (FR-NTE-1 to FR-NTE-4).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The rules under test.
import {
  addTag,
  firstLine,
  htmlToText,
  MAX_BODY_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  noteInputSchema,
  resolveNoteTitle,
} from './notes'

/** A valid note input; tests override one field at a time. */
function input(overrides: Record<string, unknown> = {}) {
  return { classId: 'swe-311-c1', title: '', contentHtml: '<p>Hello</p>', tags: [], ...overrides }
}

describe('htmlToText', () => {
  // Proves only visible text is counted, not markup.
  it('returns the text without tags', () => {
    expect(htmlToText('<p><strong>Hi</strong> there</p>')).toBe('Hi there')
  })

  // SECURITY: proves parsing runs nothing; the text of a script is not executed, only read.
  it('does not run scripts while reading', () => {
    // Arrange: a flag a script would set.
    const target = window as unknown as { pwned?: boolean }

    // Act.
    htmlToText('<img src=x onerror="window.pwned=true"><script>window.pwned=true</script>')

    // Assert.
    expect(target.pwned).toBeUndefined()
  })
})

describe('firstLine', () => {
  // Proves the first non-empty block is used, so a blank title gets a sensible stand-in.
  it('returns the first block with text', () => {
    expect(firstLine('<p></p><h2>Waterfall</h2><p>Second</p>')).toBe('Waterfall')
  })

  // Proves long lines are cut short with an ellipsis.
  it('shortens long lines', () => {
    const line = firstLine(`<p>${'a'.repeat(200)}</p>`)
    expect(line).toHaveLength(80)
    expect(line.endsWith('…')).toBe(true)
  })

  // Proves an empty body gives an empty line.
  it('returns an empty string for an empty body', () => {
    expect(firstLine('<p></p>')).toBe('')
  })
})

describe('resolveNoteTitle', () => {
  // Proves FR-NTE-1: typed title, else first line, else "Untitled note".
  it.each([
    ['  My title ', '<p>Body</p>', 'My title'],
    ['', '<p>First line</p><p>Second</p>', 'First line'],
    ['   ', '<p></p>', 'Untitled note'],
  ])('title %j with body %j becomes %j', (title, body, expected) => {
    expect(resolveNoteTitle(title, body)).toBe(expected)
  })
})

describe('noteInputSchema', () => {
  // Proves a normal note passes and its tags are trimmed.
  it('accepts a valid note', () => {
    const result = noteInputSchema.safeParse(input({ tags: [' Question '] }))
    expect(result.success).toBe(true)
    expect(result.data?.tags).toEqual(['Question'])
  })

  // Proves FR-NTE-4: the body needs text; markup alone doesn't count.
  it('rejects an empty body', () => {
    const result = noteInputSchema.safeParse(input({ contentHtml: '<p> </p>' }))
    expect(result.error?.issues[0]?.message).toBe('Write something in your note.')
  })

  // Proves FR-NTE-4: at most 20,000 characters of text.
  it('rejects a body over the limit', () => {
    const result = noteInputSchema.safeParse(
      input({ contentHtml: `<p>${'a'.repeat(MAX_BODY_LENGTH + 1)}</p>` }),
    )
    expect(result.error?.issues[0]?.message).toMatch(/20,000/)
  })

  // Proves FR-NTE-3: at most 10 tags, each at most 30 characters, no repeats.
  it.each([
    [Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${String(i)}`), /10 tags/],
    [['x'.repeat(MAX_TAG_LENGTH + 1)], /30 characters/],
    [['Question', 'question'], /once/],
  ])('rejects tags %j', (tags, message) => {
    const result = noteInputSchema.safeParse(input({ tags }))
    expect(result.error?.issues[0]?.message).toMatch(message)
  })

  // Proves a class must be chosen (FR-NTE-1).
  it('requires a class', () => {
    const result = noteInputSchema.safeParse(input({ classId: '' }))
    expect(result.error?.issues[0]?.message).toBe('Choose the class this note is for.')
  })
})

describe('addTag', () => {
  // Proves a new tag is trimmed and added.
  it('adds a trimmed tag', () => {
    expect(addTag(['Question'], '  Exam  ')).toEqual({ tags: ['Question', 'Exam'] })
  })

  // Proves the picker explains why a tag can't be added.
  it.each([
    [[], '   ', 'Type a tag first.'],
    [['Question'], 'question', 'That tag is already added.'],
    [
      Array.from({ length: MAX_TAGS }, (_, i) => `t${String(i)}`),
      'new',
      'A note can have up to 10 tags.',
    ],
    [[], 'x'.repeat(MAX_TAG_LENGTH + 1), 'Keep tags to 30 characters or fewer.'],
  ])('refuses %j + %j', (tags, raw, error) => {
    expect(addTag(tags, raw)).toEqual({ tags, error })
  })
})
