/**
 * The teacher's notices on Supabase (D111). The reading, marking and link checks are shared with
 * the student app (`@conote/supabase/notifications`); this gives them the teacher portal's
 * address, so a link can only lead inside the portal.
 */

// The client type.
import type { SupabaseClient } from '@supabase/supabase-js'

// The shared notification reader.
import { createSupabaseNotifications } from '@conote/supabase/notifications'

// The interface this implementation must satisfy.
import type { NotificationService } from '../types'

/** Builds the Supabase notification service. `origin` is the portal's own address. */
export function createSupabaseNotificationService({
  client,
  origin,
}: {
  client: SupabaseClient
  origin: string
}): NotificationService {
  // The shared reader already has the shape the portal uses.
  return createSupabaseNotifications({ client, origin })
}
