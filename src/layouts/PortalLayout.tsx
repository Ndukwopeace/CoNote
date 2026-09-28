import { Outlet } from 'react-router'

import { FullPageLoader } from '@/components/common/FullPageLoader'
import { useAuth } from '@/features/auth/useAuth'

import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/** The signed-in shell: sidebar, rail or bottom bar by screen size (REQUIREMENTS.md section 8). */
export function PortalLayout() {
  const auth = useAuth()
  if (auth.status !== 'signedIn') return <FullPageLoader />
  const { fullName, email } = auth.session.user

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <Sidebar fullName={fullName} />
      <div className="md:pl-16 lg:pl-60">
        <TopBar fullName={fullName} email={email} />
        <main id="main" tabIndex={-1} className="px-4 py-6 pb-24 outline-none md:px-8 md:pb-10">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
