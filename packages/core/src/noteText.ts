/**
 * Turns a stored note into plain text for a teacher or administrator to read (D123). Notes are
 * stored as small pieces of HTML (paragraphs, and lists or headings in older rich notes). The staff
 * screens show text only, so no markup a student typed ever runs or links out of a staff browser.
 */

/** Tags whose end, or whose `<br>`, starts a new line in the text. */
const LINE_BREAKING = new Set([
  'p',
  'div',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'tr',
  'blockquote',
  'pre',
])

/** Tags that are removed together with everything inside them. */
const REMOVED_WITH_CONTENT = new Set(['script', 'style'])

/** The entities a note stores, with `&amp;` last so that "&amp;lt;" reads as "&lt;", not "<". */
const ENTITIES: readonly (readonly [string, string])[] = [
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&#39;', "'"],
  ['&nbsp;', ' '],
  ['&amp;', '&'],
]

/** The name of a tag from its inside text: "/p" and "p class='x'" are both "p". */
function tagName(inside: string): string {
  // Skip the slash of a closing tag.
  const start = inside.startsWith('/') ? 1 : 0
  // The name runs until the first character that is not a letter or digit.
  let end = start
  while (end < inside.length && /[a-zA-Z0-9]/.test(inside.charAt(end))) end += 1
  return inside.slice(start, end).toLowerCase()
}

/** What `readPiece` found: the words up to a tag, the tag's inside text (null when none), and where to go on. */
interface Piece {
  words: string
  tag: string | null
  next: number
}

/** The next run of words from `position`, and the tag that follows it, if there is a whole one. */
function readPiece(html: string, position: number): Piece {
  const open = html.indexOf('<', position)
  const close = open === -1 ? -1 : html.indexOf('>', open)
  // No tag, or a "<" that never closes, is ordinary text to the end.
  if (close === -1) return { words: html.slice(position), tag: null, next: html.length }
  return { words: html.slice(position, open), tag: html.slice(open + 1, close), next: close + 1 }
}

/**
 * What one tag does: whether a script or style block is now being skipped (its name, or '' when
 * not), and the text to add (a line break, or nothing).
 */
function applyTag(inside: string, skipping: string): { skipping: string; text: string } {
  const name = tagName(inside)
  const closing = inside.startsWith('/')
  // Inside a script or style: only its own end tag ends the skip, and nothing is added.
  if (skipping !== '') return { skipping: closing && name === skipping ? '' : skipping, text: '' }
  // A script or style opens: skip it with everything inside.
  if (REMOVED_WITH_CONTENT.has(name) && !closing) return { skipping: name, text: '' }
  // A break, or the end of a paragraph-like tag, starts a new line.
  return { skipping: '', text: name === 'br' || (closing && LINE_BREAKING.has(name)) ? '\n' : '' }
}

/** `html` with its tags removed and its line breaks kept, before spaces are tidied. */
function stripTags(html: string): string {
  let text = ''
  // The script or style tag whose content is being skipped, or '' when none is.
  let skipping = ''
  let position = 0
  while (position < html.length) {
    const piece = readPiece(html, position)
    if (skipping === '') text += piece.words
    if (piece.tag !== null) {
      const step = applyTag(piece.tag, skipping)
      skipping = step.skipping
      text += step.text
    }
    position = piece.next
  }
  return text
}

/**
 * The note as plain lines: tags gone, entities read, one space inside a line, no empty lines at
 * the ends and at most one between paragraphs.
 */
export function noteHtmlToText(html: string): string {
  // Entities are read after the tags are gone, so a typed "&lt;b&gt;" shows as "<b>" and stays text.
  let text = stripTags(html)
  for (const [entity, character] of ENTITIES) text = text.replaceAll(entity, character)
  const kept: string[] = []
  for (const raw of text.split('\n')) {
    // One space between words, none at the ends.
    const line = raw.split(/\s+/).filter(Boolean).join(' ')
    // A second empty line in a row, or an empty first line, adds nothing.
    if (line === '' && (kept.length === 0 || kept.at(-1) === '')) continue
    kept.push(line)
  }
  // An empty last line is just the end of the final paragraph.
  while (kept.at(-1) === '') kept.pop()
  return kept.join('\n')
}
