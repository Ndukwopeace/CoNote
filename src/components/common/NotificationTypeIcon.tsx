/**
 * The round icon for a notification's type, used on Home's Recent Activity and on Notifications.
 */

// Icons, one per type.
import { Bell, FileCheck2, MessageSquare, NotebookPen, type LucideIcon } from 'lucide-react'

// The type shape.
import type { NotificationType } from '@/types/domain'

/** The icon for each type. */
const ICONS: Record<NotificationType, LucideIcon> = {
  // A summary was published.
  summary: FileCheck2,
  // A note was added.
  note: NotebookPen,
  // A teacher's message.
  message: MessageSquare,
  // A CoNote announcement.
  system: Bell,
}

/** A decorative icon in a soft circle; the text beside it carries the meaning. */
export function NotificationTypeIcon({ type }: Readonly<{ type: NotificationType }>) {
  // The icon component.
  const Icon = ICONS[type]
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
      <Icon aria-hidden="true" className="size-4" />
    </span>
  )
}
