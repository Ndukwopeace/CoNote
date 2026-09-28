/**
 * The bar across the top of every portal page: search, notifications and the account menu.
 * No logo on phones: the Home tab already leads home, and search needs the width (D35).
 */

// Magnifying-glass icon.
import { Search } from 'lucide-react'

// Text input.
import { Input } from '@/components/ui/input'

// The bell with its unread badge.
import { NotificationBell } from './NotificationBell'
// The avatar drop-down.
import { UserMenu } from './UserMenu'

/** What the top bar shows. */
interface TopBarProps {
  // For the account menu.
  fullName: string
  email: string
  // Unread notifications for the bell's badge. The notification service arrives in M5; until
  // then nothing is unread.
  unreadCount?: number
}

/** Top bar for portal pages. */
export function TopBar({ fullName, email, unreadCount = 0 }: Readonly<TopBarProps>) {
  return (
    // Stays at the top while scrolling; slightly see-through with a blur behind it.
    // The top padding keeps it below the iPhone status bar where iOS reports one (zero
    // elsewhere), and the height grows by the same amount so the row stays 64 px.
    <header className="sticky top-0 z-20 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-3 border-b bg-surface/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:px-8">
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
          // Says what can be found, so students don't have to guess (recognition over recall).
          // Short enough to fit a 360 px phone; classes are found through their course.
          placeholder="Search courses & notes"
          className="pl-9"
          disabled
        />
      </div>

      {/* Right-hand actions. */}
      <div className="ml-auto flex items-center gap-2">
        {/* Notifications, with the unread badge. On phones this is the only way there (D35). */}
        <NotificationBell unreadCount={unreadCount} />
        {/* Avatar menu. */}
        <UserMenu fullName={fullName} email={email} />
      </div>
    </header>
  )
}
