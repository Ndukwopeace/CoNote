/**
 * What a portal gives its frame: its name and where home is, its sections, and whether the
 * account menu links to Settings.
 */

// An icon component type.
import type { LucideIcon } from 'lucide-react'

/** One navigation entry. */
export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

/** A portal's description of itself. */
export interface PortalConfig {
  // "Admin" or "Teacher": the sidebar's label, and the navigation's name ("Admin navigation").
  name: string
  // Where the logo goes.
  homePath: string
  // The sections, in order.
  items: readonly NavItem[]
  // Where the account menu's Settings link goes; no Settings link when absent.
  settingsPath?: string | undefined
}
