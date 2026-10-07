/**
 * Settings, at /settings/:tab (FR-SET-1 to FR-SET-5): Profile, Account, Notifications, Privacy
 * and Help & Support. Unknown tabs go to Profile.
 */

// Links, redirects and the tab from the address.
import { Link, Navigate, useParams } from 'react-router'

// Tab title.
import { PageTitle } from '@/components/common/PageTitle'
// The five tabs.
import { AccountTab } from '@/features/settings/AccountTab'
import { HelpTab } from '@/features/settings/HelpTab'
import { NotificationSettingsTab } from '@/features/settings/NotificationSettingsTab'
import { PrivacyTab } from '@/features/settings/PrivacyTab'
import { ProfileTab } from '@/features/settings/ProfileTab'
// Tab names and link builders.
import { isSettingsTab, routeTo, SETTINGS_TABS, type SettingsTab } from '@/lib/routes'
// Class-name helper.
import { cn } from '@conote/ui/utils'

/** The words for each tab. */
const TAB_LABELS: Record<SettingsTab, string> = {
  profile: 'Profile',
  account: 'Account',
  notifications: 'Notifications',
  privacy: 'Privacy',
  help: 'Help & Support',
}

/** Settings. */
export function SettingsPage() {
  // The tab from the address.
  const { tab } = useParams()
  // SECURITY: only known tabs render; anything else goes to Profile.
  if (!isSettingsTab(tab)) return <Navigate to={routeTo.settings('profile')} replace />

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Tab title. */}
      <PageTitle title={`${TAB_LABELS[tab]} settings`} />
      {/* Page heading. */}
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
      {/* The sections, as links (each has its own address). Scrolls sideways on phones. */}
      <nav
        aria-label="Settings sections"
        className="-mx-4 overflow-x-auto border-b px-4 md:mx-0 md:px-0"
      >
        <ul className="flex gap-1">
          {SETTINGS_TABS.map((t) => (
            <li key={t}>
              <Link
                to={routeTo.settings(t)}
                aria-current={t === tab ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  t === tab && 'border-primary font-semibold text-foreground',
                )}
              >
                {TAB_LABELS[t]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* The chosen section. */}
      {tab === 'profile' && <ProfileTab />}
      {tab === 'account' && <AccountTab />}
      {tab === 'notifications' && <NotificationSettingsTab />}
      {tab === 'privacy' && <PrivacyTab />}
      {tab === 'help' && <HelpTab />}
    </div>
  )
}
