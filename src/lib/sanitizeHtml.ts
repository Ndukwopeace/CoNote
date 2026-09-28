import DOMPurify from 'dompurify'

/** Tags the note editor can produce (ENGINEERING_STANDARDS.md 6.1). */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
  'code',
  'pre',
]

const purifier = DOMPurify(window)

purifier.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/** Strips everything except basic formatting and http(s)/mailto links. */
export function sanitizeHtml(html: string): string {
  return purifier.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  })
}
