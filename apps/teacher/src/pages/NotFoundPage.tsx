/**
 * The page for an address the portal doesn't know. Inside /teacher it shows within the layout, so
 * the navigation stays; elsewhere it stands alone. The shared page (packages/portal) with the
 * portal's home.
 */

// The shared page.
import { NotFoundPage as PortalNotFoundPage } from '@conote/portal'

// Route constants.
import { TEACHER_ROUTES } from '@/lib/routes'

/** "Page not found", with a way back to My courses. */
export function NotFoundPage() {
  return <PortalNotFoundPage homePath={TEACHER_ROUTES.courses} homeLabel="Go to My courses" />
}
