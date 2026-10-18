/**
 * The statement at the top of Home (D101, D103): the CoNote mark, "Let's CoNote", the greeting,
 * and an optional line under them. Centred in the space above the composer while the stream is
 * empty (`fill`), at the top of the stream otherwise.
 */

// Children are the optional line under the greeting.
import type { ReactNode } from 'react'

// The CoNote logo.
import { Logo } from '@conote/ui/common/Logo'
// Class-name helper.
import { cn } from '@conote/ui/utils'

/** The statement. */
export function Statement({
  greeting,
  fill,
  children,
}: Readonly<{ greeting: string; fill: boolean; children?: ReactNode }>) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 px-6 text-center',
        // An empty stream centres the statement; a full one keeps it at the top.
        fill ? 'flex-1 justify-center' : 'pt-2 pb-4',
      )}
    >
      {/* The mark. Decorative: the heading names the page. */}
      <span aria-hidden="true">
        <Logo compact className="mb-2" />
      </span>
      <h1 className="text-[2.125rem] leading-tight font-bold tracking-tight">Let&apos;s CoNote</h1>
      <p className="text-muted-foreground">{greeting}</p>
      {children && <div className="mt-1 max-w-xs text-muted-foreground">{children}</div>}
    </div>
  )
}
