/**
 * What a list shows when it has nothing in it: an icon, one sentence and, where it helps, one
 * action (student REQUIREMENTS section 11, admin section 22). Shared by every portal.
 */

// Icon component type.
import type { LucideIcon } from 'lucide-react'
// Type for the message and action.
import type { ReactNode } from 'react'

/** What an empty state shows. */
interface EmptyStateProps {
  // Decorative icon.
  icon: LucideIcon
  // Short bold line.
  title: string
  // The sentence explaining why it's empty or what to do.
  children?: ReactNode
  // Optional button or link.
  action?: ReactNode
}

/** A centred, friendly "nothing here" panel. */
export function EmptyState({ icon: Icon, title, children, action }: Readonly<EmptyStateProps>) {
  return (
    // Dashed card so it reads as a gap to fill, not an error.
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-10 text-center">
      {/* Icon in a soft brand circle. */}
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-light text-primary">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      {/* The title. */}
      <p className="mt-4 font-semibold">{title}</p>
      {/* The explanation, when there is one. */}
      {children && <p className="mt-1 max-w-md text-sm text-muted-foreground">{children}</p>}
      {/* The action, when there is one. */}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
