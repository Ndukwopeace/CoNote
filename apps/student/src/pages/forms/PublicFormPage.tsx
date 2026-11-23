/**
 * A form anyone with the link can answer (D126), such as the lecturer assessment. It opens with no
 * account. It says when a form is closed or not open yet, and when the link is wrong. A long random
 * link is the only key, so the page asks search engines not to list it.
 */

// Server state.
import { useQuery } from '@tanstack/react-query'
// Icon for the "no form here" panel.
import { FileQuestion } from 'lucide-react'
// Asks search engines to skip this page.
import { useEffect } from 'react'
// The link's token.
import { useParams } from 'react-router'

// Turns any failure into an AppError.
import { appQuery } from '@conote/core/appQuery'
// The rules and the shapes.
import { answersProblem, type FormAnswers } from '@conote/core/forms'
// Shared building blocks.
import { PageTitle } from '@conote/ui/common/PageTitle'
import { FormFiller } from '@conote/ui/common/FormFiller'
import { Skeleton } from '@conote/ui/skeleton'
// What a failed load shows.
import { LoadError } from '@/components/common/LoadError'
// The services, and the query keys.
import { queryKeys } from '@/hooks/queryKeys'
import { useServices } from '@/services/useServices'

/** A heading and a sentence, for a form that cannot be answered. */
function Notice({ title, children }: Readonly<{ title: string; children: string }>) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-light text-primary">
        <FileQuestion aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

/** The public form page. */
export function PublicFormPage() {
  // The secret in the link.
  const { token = '' } = useParams()
  // The forms service.
  const { forms } = useServices()
  // The form behind the link.
  const { data, isPending, error, refetch } = useQuery({
    queryKey: queryKeys.forms.byToken(token),
    queryFn: () => appQuery(() => forms.getForm(token)),
    // A wrong link is final; retrying only slows the message down.
    retry: false,
  })

  // SECURITY: the link is a secret, so the page asks search engines not to list it.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.append(meta)
    return () => {
      meta.remove()
    }
  }, [])

  // Loading.
  if (isPending) {
    return (
      <output aria-label="Loading the form" className="block space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24" />
      </output>
    )
  }

  // Failed: a wrong link says so; anything else offers a retry.
  if (error) {
    return (
      <>
        <PageTitle title="Form" />
        <LoadError
          error={error}
          onRetry={() => void refetch()}
          notFound={
            <Notice title="We could not find this form">
              Check the link, or ask whoever sent it to you for a new one.
            </Notice>
          }
        />
      </>
    )
  }

  // Not taking answers: the title and why.
  if (data.state !== 'open') {
    return (
      <>
        <PageTitle title={data.title} />
        <Notice title={data.title}>
          {data.state === 'not_open'
            ? 'This form is not open yet. Try again later.'
            : 'This form is closed and is no longer taking responses.'}
        </Notice>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <PageTitle title={data.title} />
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{data.title}</h1>
        {data.description !== '' && (
          <p className="text-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-muted-foreground">
            {data.description}
          </p>
        )}
      </header>
      <FormFiller
        form={data}
        problem={(answers: FormAnswers) => answersProblem(data.questions, data.lecturers, answers)}
        onSubmit={(answers) => appQuery(() => forms.submit(token, answers))}
      />
    </div>
  )
}
