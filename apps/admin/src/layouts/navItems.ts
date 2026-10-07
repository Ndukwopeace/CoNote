/**
 * The console's sections, in the admin brief's order, with their icons. Used by the sidebar and
 * the phone menu, so both always list the same things.
 */

// Icons, one per section.
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  FolderOpen,
  LayoutDashboard,
  ScrollText,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'

// Route constants.
import { ADMIN_ROUTES } from '@/lib/routes'

/** One navigation entry. */
export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

/** The nine sections (admin brief, "Admin navigation"). */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', to: ADMIN_ROUTES.dashboard, icon: LayoutDashboard },
  { label: 'Users', to: ADMIN_ROUTES.users, icon: Users },
  { label: 'Courses', to: ADMIN_ROUTES.courses, icon: BookOpen },
  { label: 'Classes', to: ADMIN_ROUTES.classes, icon: CalendarDays },
  { label: 'Resources', to: ADMIN_ROUTES.resources, icon: FolderOpen },
  { label: 'AI & Summaries', to: ADMIN_ROUTES.aiSummaries, icon: Sparkles },
  { label: 'Analytics', to: ADMIN_ROUTES.analytics, icon: BarChart3 },
  { label: 'Audit Logs', to: ADMIN_ROUTES.auditLogs, icon: ScrollText },
  { label: 'Settings', to: ADMIN_ROUTES.settings, icon: Settings },
]
