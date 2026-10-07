/**
 * The avatar menu at the top right: who is signed in, Settings, and sign-out.
 */

// Icons.
import { LogOut, Settings } from 'lucide-react'
// Routing.
import { Link } from 'react-router'

// Initials for the avatar.
import { initials } from '@conote/core/initials'
// Avatar.
import { Avatar, AvatarFallback } from '@conote/ui/avatar'
// Menu parts.
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@conote/ui/dropdown-menu'

// Sign-out.
import { useAuth } from '@/features/auth/useAuth'
// Route constants.
import { ADMIN_ROUTES } from '@/lib/routes'

/** The account menu for the signed-in administrator. */
export function UserMenu({ fullName, email }: Readonly<{ fullName: string; email: string }>) {
  // Sign-out; the route guard then shows sign-in.
  const { signOut } = useAuth()

  return (
    <DropdownMenu>
      {/* The avatar button; its label says what it opens and whose account it is. */}
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
        {/* Who is signed in; long values are cut with "…". */}
        <DropdownMenuLabel>
          <p className="truncate font-semibold">{fullName}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Settings, as a real link. */}
        <DropdownMenuItem asChild>
          <Link to={ADMIN_ROUTES.settings}>
            <Settings aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* No navigation here: the route guard sends the administrator to sign-in. */}
        <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
