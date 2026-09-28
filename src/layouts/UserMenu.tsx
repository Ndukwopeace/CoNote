/**
 * The avatar drop-down in the top bar: the student's name and email, Profile, Settings and
 * Sign out.
 */

// Icons for the three menu items.
import { LogOut, Settings, UserRound } from 'lucide-react'
// Internal links.
import { Link } from 'react-router'

// Round avatar with initials.
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
// Accessible drop-down menu parts (keyboard support and focus handling included).
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
// Sign-out action.
import { useAuth } from '@/features/auth/useAuth'
// "Victory Okafor" → "VO".
import { initials } from '@/lib/initials'
// Route constants and builders.
import { ROUTES, routeTo } from '@/lib/routes'

/** The account menu. Receives the name and email to display. */
export function UserMenu({ fullName, email }: Readonly<{ fullName: string; email: string }>) {
  // Only sign-out is needed from the auth context.
  const { signOut } = useAuth()

  return (
    <DropdownMenu>
      {/* The avatar button. The aria-label says what it opens and whose account it is. */}
      <DropdownMenuTrigger
        aria-label={`Account menu for ${fullName}`}
        className="rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Avatar>
          <AvatarFallback>{initials(fullName)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      {/* The menu, aligned to the avatar's right edge. */}
      <DropdownMenuContent align="end" className="w-56">
        {/* Who is signed in; truncated so long values don't widen the menu. */}
        <DropdownMenuLabel>
          <p className="truncate font-semibold">{fullName}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Profile: the menu item renders as a real link (asChild), so it works like one. */}
        <DropdownMenuItem asChild>
          <Link to={routeTo.settings('profile')}>
            <UserRound aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>
        {/* Settings: the only way to reach Settings on phones. */}
        <DropdownMenuItem asChild>
          <Link to={ROUTES.settings}>
            <Settings aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* No navigation here: the route guard sends the student to the landing page. */}
        <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
