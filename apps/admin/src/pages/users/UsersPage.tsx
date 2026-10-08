/**
 * Users (admin REQUIREMENTS section 11): Students, Teachers and Admins tabs, with search,
 * filters, sorting and pages kept in the address, and the invite form.
 */

// The invite icon.
import { UserPlus } from 'lucide-react'
// Dialog state and a stable change handler.
import { useCallback, useState } from 'react'
// The address's query.
import { useSearchParams } from 'react-router'

// The shared vocabulary.
import type { Role } from '@conote/domain'
// Buttons, the tab title and tabs.
import { Button } from '@conote/ui/button'
import { PageTitle } from '@conote/ui/common/PageTitle'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@conote/ui/tabs'

// The invite form and the list.
import { InviteUserDialog } from '@/features/users/InviteUserDialog'
import { UserList } from '@/features/users/UserList'
// Reading and writing the filter in the address.
import { readUserFilter, writeUserFilter } from '@/lib/userFilters'
// The filter shape.
import type { UserFilterChange } from '@/types/users'

/** The tabs, in order, with their role. */
const TABS: readonly { role: Role; label: string }[] = [
  { role: 'student', label: 'Students' },
  { role: 'teacher', label: 'Teachers' },
  { role: 'admin', label: 'Admins' },
]

/** Is `value` a role? Narrows the tab's string without a cast. */
function isRole(value: string): value is Role {
  return TABS.some((tab) => tab.role === value)
}

/** Users. */
export function UsersPage() {
  // The address's query, which holds the filter.
  const [params, setParams] = useSearchParams()
  const filter = readUserFilter(params)
  // Whether the invite form is open.
  const [inviting, setInviting] = useState(false)

  /** Applies `change` to the filter in the address; anything but a page change goes back to page 1. */
  const change = useCallback(
    (update: UserFilterChange, replace = false) => {
      setParams(
        (current) => {
          // The filter now, with the change on top; the tab stays unless the change names one.
          const base = readUserFilter(current)
          return writeUserFilter({ ...base, page: 1, ...update, role: update.role ?? base.role })
        },
        { replace },
      )
    },
    [setParams],
  )

  /** Clears the search and filters, keeping the tab and sort. */
  const clear = useCallback(() => {
    setParams((current) => {
      const { role, sort } = readUserFilter(current)
      return writeUserFilter({ role, sort, page: 1 })
    })
  }, [setParams])

  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title="Users" />
      {/* Heading and the invite button. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button
          type="button"
          onClick={() => {
            setInviting(true)
          }}
        >
          <UserPlus aria-hidden="true" />
          Invite user
        </Button>
      </div>
      {/* The tabs; switching one starts that list afresh. */}
      <Tabs
        value={filter.role}
        onValueChange={(value) => {
          if (isRole(value)) setParams(writeUserFilter({ role: value, page: 1 }))
        }}
      >
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.role} value={tab.role}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* Only the selected tab's list is rendered. */}
        {TABS.map((tab) => (
          <TabsContent key={tab.role} value={tab.role}>
            <UserList filter={filter} label={tab.label} onChange={change} onClear={clear} />
          </TabsContent>
        ))}
      </Tabs>
      {/* The invite form, starting with the current tab's role. */}
      <InviteUserDialog open={inviting} onOpenChange={setInviting} role={filter.role} />
    </div>
  )
}
