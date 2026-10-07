/**
 * The bar across the top of every console page: the phone menu and logo on the left, the account
 * menu on the right.
 */

// Routing.
import { Link } from 'react-router'

// The CoNote logo.
import { Logo } from '@conote/ui/common/Logo'

// Route constants.
import { ADMIN_ROUTES } from '@/lib/routes'

// Phone navigation.
import { MobileNav } from './MobileNav'
// Account menu.
import { UserMenu } from './UserMenu'

/** The top bar. */
export function AdminTopBar({ fullName, email }: Readonly<{ fullName: string; email: string }>) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-surface/95 px-4 backdrop-blur md:px-8">
      {/* Menu button, phones only. */}
      <MobileNav />
      {/* Logo on phones only, where there is no sidebar. Its hidden wordmark names the link. */}
      <Link to={ADMIN_ROUTES.dashboard} className="shrink-0 rounded-md md:hidden">
        <Logo compact />
      </Link>
      {/* Account menu, pushed to the right. */}
      <div className="ml-auto flex items-center gap-2">
        <UserMenu fullName={fullName} email={email} />
      </div>
    </header>
  )
}
