/**
 * One person's account (admin REQUIREMENTS section 11): profile, courses, status history and the
 * actions. Note content is never shown, and there is no "view notes" action.
 */

// The back arrow.
import { ArrowLeft } from 'lucide-react'
// Children type.
import type { ReactNode } from 'react'
// Client-side links and the ID in the address.
import { Link, useParams } from 'react-router'

// Buttons, the tab title and loading blocks.
import { Button } from '@conote/ui/button'
import { PageTitle } from '@conote/ui/common/PageTitle'
import { Skeleton } from '@conote/ui/skeleton'

// Load-failure panel and the status label.
import { ErrorState } from '@conote/portal'
import { UserStatusBadge } from '@/components/users/UserStatusBadge'
// The actions shared with the list.
import { useUserActions } from '@/features/users/useUserActions'
// The details.
import { useUser } from '@/hooks/useUsers'
// Dates.
import { formatDate } from '@/lib/format'
// Addresses.
import { ADMIN_ROUTES, routeTo } from '@/lib/routes'
// Status wording.
import { statusLabel } from '@/lib/userStatus'
// The details shape.
import type { UserDetails } from '@/types/users'

/** Each status button's look: suspending is the strongest step, so only it is red. */
const STATUS_BUTTON_VARIANTS = {
  active: 'default',
  inactive: 'outline',
  suspended: 'destructive',
  pending: 'outline',
} as const

/** Each role in words. */
const ROLE_LABELS = { student: 'Student', teacher: 'Teacher', admin: 'Administrator' } as const

/** The link back to the list. */
function BackLink() {
  return (
    <Link
      to={ADMIN_ROUTES.users}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to Users
    </Link>
  )
}

/** A card with a heading. */
function Section({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  )
}

/** The profile fields as a list of terms and values. */
function Profile({ user }: Readonly<{ user: UserDetails }>) {
  // The rows that apply to this role.
  const rows: [string, string][] = [
    ['Role', ROLE_LABELS[user.role]],
    ['Email', user.email],
    ...(user.role === 'student'
      ? ([
          ['Student number', user.studentNumber ?? '—'],
          ['Level', user.level ?? '—'],
        ] satisfies [string, string][])
      : []),
    ...(user.role === 'teacher'
      ? ([['Staff number', user.staffNumber ?? '—']] satisfies [string, string][])
      : []),
    ...(user.role === 'admin'
      ? []
      : ([['Department', user.department ?? '—']] satisfies [string, string][])),
    ['Phone', user.phone ?? '—'],
    ['Created', formatDate(user.createdAt)],
    ['Last active', formatDate(user.lastActiveAt, 'Never')],
  ]
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The loaded page. */
function Details({ user }: Readonly<{ user: UserDetails }>) {
  // What can be done to this account.
  const actions = useUserActions(user)

  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title={user.fullName} />
      <BackLink />
      {/* Name, status and the actions. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{user.fullName}</h1>
            <UserStatusBadge status={user.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          {/* Why there are no status buttons on one's own account. */}
          {actions.isSelf && (
            <p className="mt-1 text-sm text-muted-foreground">This is your account.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={actions.edit}>
            Edit
          </Button>
          {actions.canAssignCourse && (
            <Button type="button" variant="outline" onClick={actions.assignCourse}>
              Assign to course
            </Button>
          )}
          {actions.canSendReset && (
            <Button type="button" variant="outline" onClick={actions.sendReset}>
              Send password reset link
            </Button>
          )}
          {actions.statusActions.map((action) => (
            <Button
              key={action.to}
              type="button"
              variant={STATUS_BUTTON_VARIANTS[action.to]}
              onClick={() => {
                actions.changeStatus(action)
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile. */}
        <div className="lg:col-span-2">
          <Section title="Profile">
            <Profile user={user} />
          </Section>
        </div>
        {/* Status history, oldest first. */}
        <Section title="Status history">
          <ol aria-label="Status history" className="space-y-3 text-sm">
            {user.statusHistory.map((change) => (
              <li key={`${change.at}-${change.status}`}>
                <span className="font-medium">{statusLabel(change.status)}</span>
                <span className="block text-muted-foreground">
                  {formatDate(change.at)}
                  {change.byName ? ` · by ${change.byName}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      </div>
      {/* Courses: enrolled in, or taught. Administrators have none. */}
      {user.role !== 'admin' && (
        <Section title={user.role === 'teacher' ? 'Courses taught' : 'Courses'}>
          {user.courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not in any course yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {user.courses.map((course) => (
                <li key={course.id}>
                  <Link to={routeTo.course(course.id)} className="hover:underline">
                    <span className="font-medium">{course.code}</span> {course.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
      {/* The confirmation and edit form the actions open. */}
      {actions.dialogs}
    </div>
  )
}

/** User details. */
export function UserDetailsPage() {
  // The account's ID from the address, and its details.
  const { userId = '' } = useParams()
  const { data, isPending, error, refetch } = useUser(userId)

  // Loaded.
  if (data) return <Details user={data} />
  // Loading: the shape of the page.
  if (isPending) {
    return (
      <output aria-label="Loading user" className="block space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
      </output>
    )
  }
  // No such account: its own message and the way back.
  if (error.kind === 'not_found') {
    return (
      <div className="space-y-4">
        <PageTitle title="User not found" />
        <h1 className="text-2xl font-bold">User not found</h1>
        <p className="text-sm text-muted-foreground">
          This account doesn't exist. It may have been removed, or the link is wrong.
        </p>
        <BackLink />
      </div>
    )
  }
  // Failed: the message and a retry.
  return <ErrorState thing="this user" onRetry={() => void refetch()} />
}
