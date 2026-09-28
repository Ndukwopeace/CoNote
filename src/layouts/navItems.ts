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
  /**
   * Shown in the phone bottom bar. Four places to work fit there with room for their labels
   * (decision D35); Notifications is the top-bar bell and Settings is in the avatar menu.
   */
  inBottomBar: boolean
}

/** Primary navigation (REQUIREMENTS.md section 8, decision D6). */
export const NAV_ITEMS: readonly NavItem[] = [
  // Home: the dashboard. "Home" is shorter and is the label phone users expect (D35).
  { label: 'Home', to: ROUTES.dashboard, icon: LayoutDashboard, inBottomBar: true },
  // Enrolled courses; classes are reached through a course.
  { label: 'Courses', to: ROUTES.courses, icon: BookOpen, inBottomBar: true },
  // All notes.
  { label: 'Notes', to: ROUTES.notes, icon: NotebookPen, inBottomBar: true },
  // Ask CoNote AI.
  { label: 'Ask AI', to: ROUTES.askAi, icon: Sparkles, inBottomBar: true },
  // Notifications: sidebar only; on phones the top-bar bell (with its unread badge) leads here.
  { label: 'Notifications', to: ROUTES.notifications, icon: Bell, inBottomBar: false },
  // Settings: sidebar only; on phones it is in the avatar menu.
  { label: 'Settings', to: ROUTES.settings, icon: Settings, inBottomBar: false },
]
