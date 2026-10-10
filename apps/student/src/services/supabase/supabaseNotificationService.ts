/**
 * The student's notifications on Supabase (milestone B2). The server writes them; a student reads
 * their own and marks them read. Row Level Security gives a student only their own rows, and the
 * only column they may change is `read`, so this service adds no owner filter of its own.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws, and the check for in-app links.
import { AppError } from '@conote/core/errors'
import { isSafeRedirect } from '@conote/core/isSafeRedirect'
// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from '@conote/supabase/ids'

// The notification shape.
import type { AppNotification } from '@/types/domain'

// The interface this implementation must satisfy.
import type { NotificationService } from '../types'

// Reads and checks rows.
import { readRows } from './rows'

// The columns of a notification the pages show.
const COLUMNS = 'id, type, title, body, link, created_at, read'
// The most notifications read at once. The list is a recent feed, not an archive.
const LIMIT = 200

// SECURITY: rows are checked on arrival, so a type or field the app does not know is refused.
const notificationRow = z.object({
  id: z.string(),
  type: z.enum(['summary', 'system', 'message', 'note']),
  title: z.string(),
  body: z.string(),
  link: z.string().nullable(),
  created_at: z.string(),
  read: z.boolean(),
})
// Only the ID, to count and to confirm a change.
const idRow = z.object({ id: z.string() })

/** Builds the Supabase notification service. `origin` is the app's own address. */
export function createSupabaseNotificationService({
  client,
  origin,
}: {
  client: SupabaseClient
  origin: string
}): NotificationService {
  /** One row as the app's notification. */
  function toNotification(row: z.infer<typeof notificationRow>): AppNotification {
    const notification: AppNotification = {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      createdAt: row.created_at,
      read: row.read,
    }
    // SECURITY: a link is followed only if it is a path inside this app. The server writes it, but
    // a bug or a compromised writer must not be able to send a student to another site (open
    // redirect) or to a "javascript:" address.
    return row.link !== null && isSafeRedirect(row.link, origin)
      ? { ...notification, link: row.link }
      : notification
  }

  return {
    async list() {
      // Newest first.
      const rows = await readRows(
        client
          .from('notifications')
          .select(COLUMNS)
          .order('created_at', { ascending: false })
          .limit(LIMIT),
        notificationRow,
      )
      return rows.map(toNotification)
    },

    async unreadCount() {
      // Only the IDs of unread ones are read; the badge needs a number, not their content.
      const rows = await readRows(
        client.from('notifications').select('id').eq('read', false).limit(LIMIT),
        idRow,
      )
      return rows.length
    },

    async markRead(notificationId) {
      // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
      if (!isUuid(notificationId)) throw new AppError('not_found', 'Notification not found')
      // Row Level Security lets a student change only their own, and only the `read` column.
      const changed = await readRows(
        client.from('notifications').update({ read: true }).eq('id', notificationId).select('id'),
        idRow,
      )
      // Nothing changed: no such notification of theirs.
      if (changed.length === 0) throw new AppError('not_found', 'Notification not found')
    },

    async markAllRead() {
      // Only the unread ones change, so already-read ones keep their rows untouched.
      await readRows(
        client.from('notifications').update({ read: true }).eq('read', false),
        z.unknown(),
      )
    },
  }
}
