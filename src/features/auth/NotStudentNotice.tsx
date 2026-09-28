import { ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { useAuth } from './useAuth'

/** Shown to teachers and admins who sign in here (REQUIREMENTS.md section 3). */
export function NotStudentNotice() {
  const { signOut } = useAuth()

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <ShieldAlert aria-hidden="true" className="mx-auto mb-4 size-10 text-primary" />
        <h1 className="text-xl font-bold">This portal is for students</h1>
        <p className="mt-2 text-muted-foreground">Please use the teacher or admin portal.</p>
        <Button className="mt-6" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </main>
  )
}
