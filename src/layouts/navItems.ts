import {
  Bell,
  BookOpen,
  LayoutDashboard,
  NotebookPen,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

import { ROUTES } from '@/lib/routes'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Shown in the phone bottom bar. Settings lives in the avatar menu there. */
  inBottomBar: boolean
}

/** Primary navigation (REQUIREMENTS.md section 8, decision D6). */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', to: ROUTES.dashboard, icon: LayoutDashboard, inBottomBar: true },
  { label: 'Courses', to: ROUTES.courses, icon: BookOpen, inBottomBar: true },
  { label: 'Notes', to: ROUTES.notes, icon: NotebookPen, inBottomBar: true },
  { label: 'Ask AI', to: ROUTES.askAi, icon: Sparkles, inBottomBar: true },
  { label: 'Notifications', to: ROUTES.notifications, icon: Bell, inBottomBar: true },
  { label: 'Settings', to: ROUTES.settings, icon: Settings, inBottomBar: false },
]
