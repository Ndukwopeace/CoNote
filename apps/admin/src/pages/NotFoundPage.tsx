/**
 * The page for an address the console doesn't know. Inside /admin it shows within the layout, so
 * the navigation stays; elsewhere it stands alone. The shared page (packages/portal) with the
 * console's home.
 */

// The shared page.
import { NotFoundPage as PortalNotFoundPage } from '@conote/portal'

// Route constants.
import { ADMIN_ROUTES } from '@/lib/routes'

/** "Page not found", with a way back to the dashboard. */
export function NotFoundPage() {
  return <PortalNotFoundPage homePath={ADMIN_ROUTES.dashboard} homeLabel="Go to the dashboard" />
}
