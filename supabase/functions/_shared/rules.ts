/**
 * The account rules the functions enforce. They match the console's own (apps/admin/src/lib/
 * userStatus.ts) so the screen offers exactly what the function will accept; the function is the
 * one that decides.
 */

/** The statuses an account can have. */
export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'pending'

/** What each status may change to. An invitation can only be withdrawn (deactivated). */
const ALLOWED: Record<AccountStatus, AccountStatus[]> = {
  active: ['inactive', 'suspended'],
  inactive: ['active', 'suspended'],
  suspended: ['active'],
  pending: ['inactive'],
}

/** Whether an administrator may move an account from `from` to `to`. */
export function canChangeStatus(from: AccountStatus, to: AccountStatus): boolean {
  return ALLOWED[from].includes(to)
}

/**
 * Whether an account in `status` may be sent a password link: accounts that can sign in, and
 * invited accounts, whose link is how they choose a password (resending an invitation).
 */
export function canSendPasswordReset(status: AccountStatus): boolean {
  return status === 'active' || status === 'pending'
}

/** Whether an account in `status` may be deleted: only an invitation nobody has accepted. */
export function canDeleteInvitation(status: AccountStatus): boolean {
  return status === 'pending'
}
