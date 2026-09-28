/**
 * The primary navigation list, shared by the sidebar and the phone bottom bar so they never
 * disagree.
 */

// One icon per destination, and the icon component type.
import {
  Bell,
  BookOpen,
  LayoutDashboard,
  NotebookPen,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

// Route constants.
import { ROUTES } from '@/lib/routes'

/** One navigation destination. */
export interface NavItem {
  // Visible text and accessible name.
  label: string
  // Where it goes.
  to: string
  // Its icon.
  icon: LucideIcon
  /** Shown in the phone bottom bar. Settings lives in the avatar menu there. */
  inBottomBar: boolean
}

/** Primary navigation (REQUIREMENTS.md section 8, decision D6). */
export const NAV_ITEMS: readonly NavItem[] = [
  // Home.
  { label: 'Dashboard', to: ROUTES.dashboard, icon: LayoutDashboard, inBottomBar: true },
  // Enrolled courses; classes are reached through a course.
  { label: 'Courses', to: ROUTES.courses, icon: BookOpen, inBottomBar: true },
  // All notes.
  { label: 'Notes', to: ROUTES.notes, icon: NotebookPen, inBottomBar: true },
  // Ask CoNote AI.
  { label: 'Ask AI', to: ROUTES.askAi, icon: Sparkles, inBottomBar: true },
  // Notifications.
  { label: 'Notifications', to: ROUTES.notifications, icon: Bell, inBottomBar: true },
  // Settings: sidebar only; the bottom bar holds five items.
  { label: 'Settings', to: ROUTES.settings, icon: Settings, inBottomBar: false },
]
