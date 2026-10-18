/**
 * Home's top bar (D103): the menu button (phones), the Note | Ask switch, and the bell.
 */

// Icons.
import { Bell, Menu } from 'lucide-react'
// Client-side links.
import { Link } from 'react-router'

// Class-name helper.
import { cn } from '@conote/ui/utils'
// Addresses.
import { ROUTES } from '@/lib/routes'

/** The two modes of Home. */
export type HomeMode = 'note' | 'ask'

/** The top bar. */
export function TopBar({
  mode,
  onModeChange,
  onMenu,
  unread,
}: Readonly<{
  mode: HomeMode
  onModeChange: (mode: HomeMode) => void
  onMenu: () => void
  unread: number
}>) {
  /** The round, bordered button look the menu and bell share. */
  const round =
    'relative flex size-11 items-center justify-center rounded-full border bg-card outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50'

  return (
    <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
      {/* The menu opens the drawer on phones; wider screens have the sidebar instead. */}
      <button
        type="button"
        aria-label="Open menu"
        onClick={onMenu}
        className={cn(round, 'md:hidden')}
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>
      <span aria-hidden="true" className="hidden size-11 md:block" />
      {/* Note | Ask: the same screen with a different job. */}
      <fieldset className="flex min-w-0 gap-0.5 rounded-full border bg-card p-1">
        <legend className="sr-only">Mode</legend>
        {(['note', 'ask'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => {
              onModeChange(option)
            }}
            className={cn(
              'min-h-10 rounded-full px-6 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              mode === option ? 'bg-muted text-foreground' : 'text-muted-foreground',
            )}
          >
            {option === 'note' ? 'Note' : 'Ask'}
          </button>
        ))}
      </fieldset>
      {/* Notifications, with a dot while any are unread. */}
      <Link
        to={ROUTES.notifications}
        aria-label={unread > 0 ? `Notifications, ${String(unread)} unread` : 'Notifications'}
        className={round}
      >
        <Bell aria-hidden="true" className="size-5" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-primary"
          />
        )}
      </Link>
    </header>
  )
}
