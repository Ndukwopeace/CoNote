/**
 * Cleans note HTML before it is shown on screen. The only way user-written HTML reaches the
 * page is through SafeHtml, which calls this (ENGINEERING_STANDARDS.md 6.1).
 */

// DOMPurify is a widely used, security-audited HTML sanitiser.
import DOMPurify from 'dompurify'

/**
 * Tags the note editor can produce. Everything else is removed.
 * SECURITY: an allow-list (not a block-list) means new or obscure tags such as <script>,
 * <iframe>, <img onerror>, <svg>, <form> or <style> are dropped by default. Those are the tags
 * used to run code in another student's browser (cross-site scripting, XSS) or to fake parts
 * of the page.
 */
const ALLOWED_TAGS = [
  // Paragraph.
  'p',
  // Line break.
  'br',
  // Bold.
  'strong',
  // Italic.
  'em',
  // Underline.
  'u',
  // Section heading.
  'h2',
  // Sub-heading.
  'h3',
  // Bulleted list.
  'ul',
  // Numbered list.
  'ol',
  // List item.
  'li',
  // Link (its address is checked separately below).
  'a',
  // Quotation.
  'blockquote',
  // Inline code.
  'code',
  // Code block.
  'pre',
]

// A private DOMPurify instance, so the hook below cannot affect any other code using DOMPurify.
const purifier = DOMPurify(window)

// Runs after DOMPurify has filtered each element's attributes.
purifier.addHook('afterSanitizeAttributes', (node) => {
  // Only links need extra attributes.
  if (node.tagName === 'A') {
    // Open links in a new tab so the student does not lose their place in CoNote.
    node.setAttribute('target', '_blank')
    // SECURITY: "noopener" stops the opened page from controlling the CoNote tab through
    // window.opener (reverse tabnabbing, where the CoNote tab is swapped for a fake login page).
    // "noreferrer" stops the CoNote address from being sent to the other site.
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/** Strips everything except basic formatting and http(s)/mailto links. */
export function sanitizeHtml(html: string): string {
  // Run the sanitiser with CoNote's rules and return the cleaned HTML string.
  return purifier.sanitize(html, {
    // SECURITY: only the tags listed above survive.
    ALLOWED_TAGS,
    // SECURITY: only "href" survives. This removes onclick, onerror, style and every other
    // attribute that can run code or restyle the page.
    ALLOWED_ATTR: ['href'],
    // SECURITY: links must be http, https or mailto. This blocks "javascript:" links (which run
    // code when clicked) and "data:" links (which can carry a whole fake page).
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  })
}
