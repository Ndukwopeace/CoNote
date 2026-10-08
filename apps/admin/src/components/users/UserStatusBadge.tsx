/**
 * An account's status as a tinted label (admin REQUIREMENTS section 21, StatusBadge). The word is
 * always shown, so colour is never the only signal.
 */

// The shared vocabulary.
import type { AccountStatus } from '@conote/domain'
// The badge.
import { Badge } from '@conote/ui/badge'

// Status wording.
import { statusLabel } from '@/lib/userStatus'

/** The badge colour for each status. */
const VARIANTS = {
  active: 'success',
  pending: 'warning',
  suspended: 'destructive',
  inactive: 'outline',
} as const satisfies Record<AccountStatus, string>

/** The status label. */
export function UserStatusBadge({ status }: Readonly<{ status: AccountStatus }>) {
  return <Badge variant={VARIANTS[status]}>{statusLabel(status)}</Badge>
}
