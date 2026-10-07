/**
 * The single component allowed to put user-written HTML on the page.
 */

// The sanitiser with CoNote's allow-list.
import { sanitizeHtml } from '@/lib/sanitizeHtml'

/**
 * The only component allowed to inject HTML (ENGINEERING_STANDARDS.md 6.1).
 * Everything passes through the sanitiser's allow-list first.
 */
export function SafeHtml({ html, className }: Readonly<{ html: string; className?: string }>) {
  // SECURITY: blocks cross-site scripting (XSS). The HTML is sanitised before insertion, so a
  // note containing <script>, an onerror handler or a javascript: link cannot run code in the
  // reader's browser. ESLint bans dangerouslySetInnerHTML everywhere except this file.
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
}
