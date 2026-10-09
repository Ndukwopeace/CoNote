/**
 * The phone navigation: a menu button that opens the sections in a panel from the left. The panel
 * closes when a section is chosen.
 */

// Icon.
import { Menu } from 'lucide-react'
// Open state.
import { useState } from 'react'

// A link that marks the current section.
import { SidebarLink } from '@conote/ui/common/SidebarLink'
// Button.
import { Button } from '@conote/ui/button'
// The sliding panel.
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@conote/ui/sheet'

// The sections.
import type { NavItem } from './navItems'

/** Menu button plus navigation panel, for phone widths only. */
export function MobileNav({ items }: Readonly<{ items: readonly NavItem[] }>) {
  // Whether the panel is open; closed again after a choice.
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* The menu button; hidden from tablet width up, where the sidebar shows. */}
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      {/* The panel. Its title names the dialog for screen readers. */}
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="px-5 pt-5 text-base">Navigation</SheetTitle>
        {/* The same sections as the sidebar. */}
        <nav aria-label="Phone navigation" className="px-3 py-4">
          <ul className="space-y-1">
            {items.map(({ label, to, icon: Icon }) => (
              <li key={to}>
                {/* Choosing a section closes the panel. */}
                <SidebarLink
                  to={to}
                  onClick={() => {
                    setOpen(false)
                  }}
                  className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  activeClassName="bg-primary-light text-primary-dark"
                >
                  {/* Decorative icon. */}
                  <Icon aria-hidden="true" className="size-5 shrink-0" />
                  {label}
                </SidebarLink>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
