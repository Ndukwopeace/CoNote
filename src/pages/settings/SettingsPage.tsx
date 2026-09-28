/**
 * Settings page (placeholder until M5). Already checks the tab in the address.
 */

// Navigate redirects; useParams reads the :tab segment.
import { Navigate, useParams } from 'react-router'

// Temporary page body.
import { PlaceholderPage } from '@/components/common/PlaceholderPage'
// Tab check and settings path builder.
import { isSettingsTab, routeTo } from '@/lib/routes'

/** Settings, at /settings/:tab. */
export function SettingsPage() {
  // The tab from the address, e.g. "privacy" in /settings/privacy.
  const { tab } = useParams()
  // SECURITY: only known tab names are accepted. A missing or made-up tab goes to Profile, so a
  // crafted address can't put the page into an unexpected state.
  if (!isSettingsTab(tab)) return <Navigate to={routeTo.settings('profile')} replace />

  return (
    // Placeholder body until M5 builds the tabs.
    <PlaceholderPage
      title="Settings"
      description="Profile, account, notification, privacy and help settings."
    />
  )
}
