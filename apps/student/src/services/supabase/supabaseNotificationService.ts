/**
 * The student's notifications on Supabase (milestone B2). The reading, marking and link checks are
 * shared with the teacher portal (`@conote/supabase/notifications`); this gives them the
 * student app's address, so a link can only lead inside the student app.
 */

// The client type.
import type { SupabaseClient } from '@supabase/supabase-js'

// The shared notification reader.
import { createSupabaseNotifications } from '@conote/supabase/notifications'

// The interface this implementation must satisfy.
import type { NotificationService } from '../types'

/** Builds the Supabase notification service. `origin` is the app's own address. */
export function createSupabaseNotificationService({
  client,
  origin,
}: {
  client: SupabaseClient
  origin: string
}): NotificationService {
  // The shared reader already has the shape the student app uses.
  return createSupabaseNotifications({ client, origin })
}
