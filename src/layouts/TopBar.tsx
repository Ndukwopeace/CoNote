import { Bell, Search } from 'lucide-react'
import { Link } from 'react-router'

import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/lib/routes'

import { UserMenu } from './UserMenu'

export function TopBar({ fullName, email }: { fullName: string; email: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-surface/95 px-4 backdrop-blur md:px-8">
      <Link to={ROUTES.dashboard} className="rounded-md md:hidden">
        <Logo compact />
      </Link>

      {/* Search arrives with M5 (REQUIREMENTS.md section 8); disabled until it works. */}
      <div className="relative max-w-md flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search courses, classes and notes"
          placeholder="Search…"
          className="pl-9"
          disabled
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to={ROUTES.notifications} aria-label="Notifications">
            <Bell aria-hidden="true" className="size-5" />
          </Link>
        </Button>
        <UserMenu fullName={fullName} email={email} />
      </div>
    </header>
  )
}
