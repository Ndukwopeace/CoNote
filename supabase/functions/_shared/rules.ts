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

/** Whether an account in `status` may be sent a password link: only accounts that can sign in. */
export function canSendPasswordReset(status: AccountStatus): boolean {
  return status === 'active'
}
