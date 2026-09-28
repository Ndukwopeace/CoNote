/**
 * The rules for a note (REQUIREMENTS.md FR-NTE-1 to FR-NTE-4). The note form and the note
 * service share them, so the browser and the "server" can never disagree.
 */

// zod describes the note's shape and rules, and gives the error messages.
import { z } from 'zod'

/** The four preset tags (FR-NTE-3). */
export const PRESET_TAGS = ['Key concept', 'Question', 'Example', 'Aha moment'] as const
/** Most tags on one note (FR-NTE-3). */
export const MAX_TAGS = 10
/** Longest tag (FR-NTE-3). */
export const MAX_TAG_LENGTH = 30
/** Most characters of text in a note body (FR-NTE-4). */
export const MAX_BODY_LENGTH = 20_000
/** Longest title; long enough for a sentence, short enough for list rows. */
export const MAX_TITLE_LENGTH = 120
/** Longest title made from the body's first line. */
const FIRST_LINE_LENGTH = 80

/** Blocks whose text can serve as a note's first line. */
const LINE_BLOCKS = 'p, h2, h3, li, blockquote, pre'

/**
 * Parses note HTML into an inert document.
 * SECURITY: DOMParser builds a detached document that never runs scripts or loads images, so
 * reading a hostile note here can't execute anything (unlike putting it into the live page).
 */
function parse(html: string) {
  // A throwaway document; nothing in it is attached to the page.
  return new DOMParser().parseFromString(html, 'text/html')
}

/** The visible text of note HTML, with spaces collapsed; used for length checks and search. */
export function htmlToText(html: string): string {
  // All text nodes, joined; runs of whitespace become one space.
  return parse(html).body.textContent.replace(/\s+/g, ' ').trim()
}

/** The first block of text in a note body, shortened to 80 characters, or "" if there is none. */
export function firstLine(html: string): string {
  // Every block that could hold a line.
  const blocks = Array.from(parse(html).body.querySelectorAll(LINE_BLOCKS))
  // The first one with text.
  const text = blocks.map((block) => block.textContent.trim()).find((line) => line !== '') ?? ''
  // Short enough: as is.
  if (text.length <= FIRST_LINE_LENGTH) return text
  // Too long: cut and mark with an ellipsis (the ellipsis is the 80th character).
  return `${text.slice(0, FIRST_LINE_LENGTH - 1).trimEnd()}…`
}

/** The title a note is saved with: the typed one, else the first line, else "Untitled note" (FR-NTE-1). */
export function resolveNoteTitle(title: string, contentHtml: string): string {
  // The typed title wins when it has any text.
  const typed = title.trim()
  if (typed !== '') return typed
  // Otherwise the body's first line, or the stand-in.
  return firstLine(contentHtml) || 'Untitled note'
}

/** One tag: trimmed, 1–30 characters. */
const tagSchema = z
  .string()
  // Spaces around a tag are noise.
  .trim()
  // An empty tag means nothing.
  .min(1, 'Tags cannot be empty.')
  // FR-NTE-3 limit.
  .max(MAX_TAG_LENGTH, `Keep tags to ${String(MAX_TAG_LENGTH)} characters or fewer.`)

/**
 * What a student submits to create or edit a note.
 * SECURITY: the note service checks this again, so a request that skips the form still meets
 * the limits (oversized notes would otherwise fill storage or slow every list).
 */
export const noteInputSchema = z.object({
  // The class the note belongs to.
  classId: z.string().min(1, 'Choose the class this note is for.'),
  // Optional title; blank is allowed (resolveNoteTitle fills it in).
  title: z
    .string()
    .trim()
    .max(MAX_TITLE_LENGTH, `Keep the title to ${String(MAX_TITLE_LENGTH)} characters or fewer.`),
  // The rich-text body, judged by its visible text.
  contentHtml: z
    .string()
    .refine((html) => htmlToText(html).length > 0, 'Write something in your note.')
    .refine(
      (html) => htmlToText(html).length <= MAX_BODY_LENGTH,
      `Notes can be up to ${MAX_BODY_LENGTH.toLocaleString('en-GB')} characters.`,
    ),
  // Up to 10 distinct tags.
  tags: z
    .array(tagSchema)
    .max(MAX_TAGS, `A note can have up to ${String(MAX_TAGS)} tags.`)
    .refine(
      (tags) => new Set(tags.map((tag) => tag.toLowerCase())).size === tags.length,
      'Use each tag only once.',
    ),
})

/** The note input type, after trimming. */
export type NoteInput = z.output<typeof noteInputSchema>

/** The result of trying to add a tag: the new list, or the old one with a reason. */
export type AddTagResult = { tags: string[]; error?: undefined } | { tags: string[]; error: string }

/** Adds `raw` to `tags` if it fits the FR-NTE-3 rules; otherwise explains why not. */
export function addTag(tags: string[], raw: string): AddTagResult {
  // Spaces around a tag are noise.
  const tag = raw.trim()
  // Nothing typed.
  if (tag === '') return { tags, error: 'Type a tag first.' }
  // Too long.
  if (tag.length > MAX_TAG_LENGTH) {
    return { tags, error: `Keep tags to ${String(MAX_TAG_LENGTH)} characters or fewer.` }
  }
  // Already there, in any case.
  if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
    return { tags, error: 'That tag is already added.' }
  }
  // Full.
  if (tags.length >= MAX_TAGS)
    return { tags, error: `A note can have up to ${String(MAX_TAGS)} tags.` }
  // Fits: a new list, so the caller's array is untouched.
  return { tags: [...tags, tag] }
}
