/**
 * Which status changes an administrator may make, and how statuses read (admin REQUIREMENTS
 * section 11). The service enforces the same rules; the screens use them to offer only valid
 * actions.
 */

// The shared vocabulary.
import type { AccountStatus } from '@conote/domain'

/** One change an administrator can make. */
export interface StatusAction {
  // The status it moves to.
  to: AccountStatus
  // The button's words.
  label: 'Activate' | 'Deactivate' | 'Suspend'
  // Whether to ask first: blocking someone does; restoring them doesn't.
  confirm: boolean
}

/** The three actions. */
const ACTIVATE: StatusAction = { to: 'active', label: 'Activate', confirm: false }
const DEACTIVATE: StatusAction = { to: 'inactive', label: 'Deactivate', confirm: true }
const SUSPEND: StatusAction = { to: 'suspended', label: 'Suspend', confirm: true }

/** What each status may change to. An invitation can only be withdrawn (deactivated). */
const ALLOWED: Record<AccountStatus, StatusAction[]> = {
  active: [DEACTIVATE, SUSPEND],
  inactive: [ACTIVATE, SUSPEND],
  suspended: [ACTIVATE],
  pending: [DEACTIVATE],
}

/** The changes an administrator may make from `status`, in button order. */
export function statusActions(status: AccountStatus): StatusAction[] {
  return ALLOWED[status]
}

/** Whether moving from `from` to `to` is allowed. */
export function canChangeStatus(from: AccountStatus, to: AccountStatus): boolean {
  return ALLOWED[from].some((action) => action.to === to)
}

/** Each status in words. "pending" reads as "Invited", which is what it means to people. */
const LABELS: Record<AccountStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
  pending: 'Invited',
}

/** `status` in words. */
export function statusLabel(status: AccountStatus): string {
  return LABELS[status]
}

/** Only active accounts can be sent a reset link; the others can't sign in anyway. */
export function canSendPasswordReset(status: AccountStatus): boolean {
  return status === 'active'
}
