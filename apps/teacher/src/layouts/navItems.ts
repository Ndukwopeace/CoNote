/**
 * The portal's sections, with their icons. Used by the sidebar and the phone menu, so both always
 * list the same things.
 */

// Icons, one per section.
import { BookOpen, ClipboardCheck, type LucideIcon } from 'lucide-react'

// Route constants.
import { TEACHER_ROUTES } from '@/lib/routes'

/** One navigation entry. */
export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

/** The sections (teacher REQUIREMENTS section 4). */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'My courses', to: TEACHER_ROUTES.courses, icon: BookOpen },
  { label: 'Review queue', to: TEACHER_ROUTES.reviews, icon: ClipboardCheck },
]
