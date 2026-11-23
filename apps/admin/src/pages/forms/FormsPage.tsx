/**
 * Forms (D126): the forms an administrator built, such as the lecturer assessment. Each shows whether it
 * is taking answers, how many it has, and its link. "New form" makes one from the lecturer assessment
 * template and opens it to edit, like Google Forms makes an untitled form.
 */

// Icons for the empty state and the new-form button.
import { ClipboardList, Plus } from 'lucide-react'
// Client-side links, and moving to the new form.
import { Link, useNavigate } from 'react-router'

// The tab title, the empty panel, the badge, the button and loading blocks.
import { PageTitle } from '@conote/ui/common/PageTitle'
import { EmptyState } from '@conote/ui/common/EmptyState'
import { Badge } from '@conote/ui/badge'
import { Button } from '@conote/ui/button'
import { Skeleton } from '@conote/ui/skeleton'
// Load-failure panel.
import { ErrorState } from '@conote/portal'

// The data.
import { useCreateForm, useForms } from '@/hooks/useForms'
// Wording and dates.
import { formatDate } from '@/lib/format'
import { stateLabel } from '@/lib/forms'
// Addresses.
import { routeTo } from '@/lib/routes'

/** Forms. */
export function FormsPage() {
  // The forms, and making a new one.
  const { data, isPending, isError, refetch } = useForms()
  const create = useCreateForm()
  const navigate = useNavigate()

  /** Makes a form from the template and opens it. */
  function newForm() {
    create.mutate(undefined, {
      onSuccess: (id) => {
        void navigate(routeTo.form(id))
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title="Forms" />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Forms</h1>
          <p className="text-sm text-muted-foreground">
            Build a form, share its link, and read the answers. Anyone with the link can answer; no
            account is needed.
          </p>
        </div>
        <Button type="button" onClick={newForm} disabled={create.isPending}>
          <Plus aria-hidden="true" />
          {create.isPending ? 'Making the form…' : 'New form'}
        </Button>
      </header>
      {create.isError && (
        <p role="alert" className="text-sm text-destructive">
          We could not make a new form. Try again.
        </p>
      )}
      {isError && <ErrorState thing="forms" onRetry={() => void refetch()} />}
      {isPending && (
        <output aria-label="Loading forms" className="block space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </output>
      )}
      {data?.length === 0 && (
        <EmptyState icon={ClipboardList} title="No forms yet.">
          Choose New form to start from the lecturer assessment.
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <ul aria-label="Forms" className="divide-y rounded-xl border bg-card">
          {data.map((form) => (
            <li
              key={form.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="space-y-1">
                <Link
                  to={routeTo.form(form.id)}
                  className="font-semibold underline-offset-4 hover:underline"
                >
                  {form.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {`${String(form.questionCount)} questions · created ${formatDate(form.createdAt)}`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Badge variant={form.state === 'open' ? 'success' : 'secondary'}>
                  {stateLabel(form.state)}
                </Badge>
                <Link
                  to={routeTo.formResults(form.id)}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {`${String(form.responseCount)} ${form.responseCount === 1 ? 'response' : 'responses'}`}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
