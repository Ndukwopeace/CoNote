import { Navigate, useParams } from 'react-router'

import { PlaceholderPage } from '@/components/common/PlaceholderPage'
import { isSettingsTab, routeTo } from '@/lib/routes'

export function SettingsPage() {
  const { tab } = useParams()
  if (!isSettingsTab(tab)) return <Navigate to={routeTo.settings('profile')} replace />

  return (
    <PlaceholderPage
      title="Settings"
      milestone="M5"
      description="Profile, account, notification, privacy and help settings."
    />
  )
}
