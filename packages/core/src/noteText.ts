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

/** `html` with its tags removed and its line breaks kept, before spaces are tidied. */
function stripTags(html: string): string {
  let text = ''
  // The script or style tag whose content is being skipped, or '' when none is.
  let skipping = ''
  let position = 0
  while (position < html.length) {
    const open = html.indexOf('<', position)
    // The words before the next tag, or to the end.
    const words = html.slice(position, open === -1 ? html.length : open)
    if (skipping === '') text += words
    if (open === -1) break
    const close = html.indexOf('>', open)
    // A "<" that never closes is ordinary text, not a tag.
    if (close === -1) {
      if (skipping === '') text += html.slice(open)
      break
    }
    const inside = html.slice(open + 1, close)
    const name = tagName(inside)
    const closing = inside.startsWith('/')
    if (skipping !== '') {
      // Inside a script or style: only its own end tag ends the skip.
      if (closing && name === skipping) skipping = ''
    } else if (REMOVED_WITH_CONTENT.has(name) && !closing) {
      skipping = name
    } else if (name === 'br' || (closing && LINE_BREAKING.has(name))) {
      text += '\n'
    }
    position = close + 1
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
