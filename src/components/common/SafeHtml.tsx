import { sanitizeHtml } from '@/lib/sanitizeHtml'

/**
 * The only component allowed to inject HTML (ENGINEERING_STANDARDS.md 6.1).
 * Everything passes through the sanitiser's allow-list first.
 */
export function SafeHtml({ html, className }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
}
