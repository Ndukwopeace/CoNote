/**
 * The bar across the top of every portal page: logo (phones), search, notifications and the
 * account menu.
 */

// Bell and magnifying-glass icons.
import { Bell, Search } from 'lucide-react'
// Internal links.
import { Link } from 'react-router'

// The CoNote logo.
import { Logo } from '@/components/common/Logo'
// Standard button styles.
import { Button } from '@/components/ui/button'
// Text input.
import { Input } from '@/components/ui/input'
// Route constants.
import { ROUTES } from '@/lib/routes'

// The avatar drop-down.
import { UserMenu } from './UserMenu'

/** Top bar for portal pages. Receives the student's name and email for the account menu. */
export function TopBar({ fullName, email }: { fullName: string; email: string }) {
  return (
    // Stays at the top while scrolling; slightly see-through with a blur behind it.
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-surface/95 px-4 backdrop-blur md:px-8">
      {/* Logo on phones only, where there is no sidebar. */}
      <Link to={ROUTES.dashboard} className="rounded-md md:hidden">
        <Logo compact />
      </Link>

      {/* Search arrives with M5 (REQUIREMENTS.md section 8); disabled until it works. */}
      <div className="relative max-w-md flex-1">
        {/* Magnifying glass inside the field; decorative, and ignores clicks. */}
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        {/* The field. aria-label names it because there is no visible label. */}
        <Input
          type="search"
          aria-label="Search courses, classes and notes"
          placeholder="Search…"
          className="pl-9"
          disabled
        />
      </div>

      {/* Right-hand actions. */}
      <div className="ml-auto flex items-center gap-2">
        {/* Notifications: an icon-only link, so aria-label gives it a name. */}
        <Button variant="ghost" size="icon" asChild>
          <Link to={ROUTES.notifications} aria-label="Notifications">
            <Bell aria-hidden="true" className="size-5" />
          </Link>
        </Button>
        {/* Avatar menu. */}
        <UserMenu fullName={fullName} email={email} />
      </div>
    </header>
  )
}
