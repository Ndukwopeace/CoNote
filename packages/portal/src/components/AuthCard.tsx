/**
 * The centred card around the sign-in, forgot-password and reset-password pages.
 */

// Children type.
import type { ReactNode } from 'react'

// Logo and tab title.
import { Logo } from '@conote/ui/common/Logo'
import { PageTitle } from '@conote/ui/common/PageTitle'

/** What the card shows: its tab title and the page's content. */
interface AuthCardProps {
  title: string
  children: ReactNode
}

/** A full-page centred card with the CoNote logo at the top. */
export function AuthCard({ title, children }: Readonly<AuthCardProps>) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      {/* Tab title. */}
      <PageTitle title={title} />
      {/* The card. */}
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        {/* Brand. */}
        <Logo />
        {/* The page's own content, starting with its h1. */}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  )
}
