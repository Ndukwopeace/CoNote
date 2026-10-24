/**
 * A person's notifications on Supabase, for every app that has a bell (milestone B2, D111). The
 * server writes them; a person reads their own and marks them read. Row Level Security gives a
 * person only their own rows, and the only column they may change is `read`, so this adds no
 * owner filter of its own. Each app wraps it with its own address, so a link only ever leads
 * inside that app.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws, and the check for in-app links.
import { AppError } from '@conote/core/errors'
import { isSafeRedirect } from '@conote/core/isSafeRedirect'
// The categories a notification can have.
import type { NotificationType } from '@conote/domain'

// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from './ids'
// Reads and checks rows.
import { readRows } from './rows'

/** One notification, as an app shows it. */
export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string
  // An in-app path to open, left out when there is none or it is not safe.
  link?: string
  // ISO 8601 time.
  createdAt: string
  read: boolean
}

/** What an app can do with a person's notifications. */
export interface NotificationReader {
  /** Newest first. */
  list(): Promise<NotificationItem[]>
  /** How many are unread, for a badge. */
  unreadCount(): Promise<number>
  /** Marks one as read; not_found when it is not theirs. */
  markRead(notificationId: string): Promise<void>
  /** Marks every one as read. */
  markAllRead(): Promise<void>
}

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

/** Builds the notification reader. `origin` is the app's own address. */
export function createSupabaseNotifications({
  client,
  origin,
}: {
  client: SupabaseClient
  origin: string
}): NotificationReader {
  /** One row as the app's notification. */
  function toNotification(row: z.infer<typeof notificationRow>): NotificationItem {
    const notification: NotificationItem = {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      createdAt: row.created_at,
      read: row.read,
    }
    // SECURITY: a link is followed only if it is a path inside this app. The server writes it, but
    // a bug or a compromised writer must not be able to send a person to another site (open
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
      // Row Level Security lets a person change only their own, and only the `read` column.
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
