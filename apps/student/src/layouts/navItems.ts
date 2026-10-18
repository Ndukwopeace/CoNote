/**
 * The primary navigation list, shared by the sidebar and the phone bottom bar so they never
 * disagree.
 */

// One icon per destination, and the icon component type.
import {
  Bell,
  BookOpen,
  CalendarDays,
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
  /**
   * Marks the destination as one that shows example content while its service is the demo one.
   * The label shows only then: a real service (`isPreview` false) takes it off (FR-AI-9).
   */
  preview?: boolean
}

/** Primary navigation (REQUIREMENTS.md section 8, decision D6). */
export const NAV_ITEMS: readonly NavItem[] = [
  // Home: the dashboard. "Home" is shorter and is the label phone users expect (D35).
  { label: 'Home', to: ROUTES.dashboard, icon: LayoutDashboard, inBottomBar: true },
  // Enrolled courses; a course's classes are on its Classes tab.
  { label: 'Courses', to: ROUTES.courses, icon: BookOpen, inBottomBar: true },
  // Every class across the courses (Today, Upcoming, Past). Home no longer links here (D101), so
  // it is in the sidebar; on phones the bottom bar keeps its four places to work.
  { label: 'Classes', to: ROUTES.classes, icon: CalendarDays, inBottomBar: false },
  // All notes.
  { label: 'Notes', to: ROUTES.notes, icon: NotebookPen, inBottomBar: true },
  // Ask CoNote AI. In the demo its replies are canned examples, so it carries the Preview label.
  { label: 'Ask AI', to: ROUTES.askAi, icon: Sparkles, inBottomBar: true, preview: true },
  // Notifications: sidebar only; on phones the top-bar bell (with its unread badge) leads here.
  { label: 'Notifications', to: ROUTES.notifications, icon: Bell, inBottomBar: false },
  // Settings: sidebar only; on phones it is in the avatar menu.
  { label: 'Settings', to: ROUTES.settings, icon: Settings, inBottomBar: false },
]
