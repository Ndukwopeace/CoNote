/**
 * The Forms pages' data (D126): the list, one form, its results and answers, and the changes. A change
 * refreshes every Forms query, so the list, the builder and the results never disagree.
 */

// Server state, mutations, the cache, and keeping the old page while the next loads.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Turns any failure into an AppError.
import { appQuery } from '@conote/core/appQuery'

// The template a new form starts from.
import { TEMPLATE_QUESTIONS } from '@/lib/forms'
// The services.
import { useServices } from '@/services/useServices'
// The shapes.
import type { FormDraft, FormResponseFilter } from '@/types/forms'

// Query keys.
import { queryKeys } from './queryKeys'

/** Every form. */
export function useForms() {
  // The form service.
  const { forms } = useServices()
  return useQuery({
    queryKey: queryKeys.forms.list(),
    queryFn: () => appQuery(() => forms.listForms()),
  })
}

/** One form with its questions. */
export function useForm(formId: string) {
  // The form service.
  const { forms } = useServices()
  return useQuery({
    queryKey: queryKeys.forms.detail(formId),
    queryFn: () => appQuery(() => forms.getForm(formId)),
  })
}

/** A form's results by course and lecturer. */
export function useFormSummary(formId: string) {
  // The form service.
  const { forms } = useServices()
  return useQuery({
    queryKey: queryKeys.forms.summary(formId),
    queryFn: () => appQuery(() => forms.getSummary(formId)),
  })
}

/** One page of a form's answers. The previous page stays on screen while the next loads. */
export function useFormResponses(formId: string, filter: FormResponseFilter) {
  // The form service.
  const { forms } = useServices()
  return useQuery({
    queryKey: queryKeys.forms.responses(formId, filter),
    queryFn: () => appQuery(() => forms.listResponses(formId, filter)),
    placeholderData: keepPreviousData,
  })
}

/** Creates a form from the template and returns its ID. */
export function useCreateForm() {
  // The form service, and the cache to refresh.
  const { forms } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      appQuery(() =>
        forms.saveForm({
          title: 'Lecturer assessment',
          description: '',
          accepting: false,
          opensAt: null,
          closesAt: null,
          questions: TEMPLATE_QUESTIONS.map((question) => ({ ...question })),
        }),
      ),
    // Hook-level, not in mutate(): the page that started it is replaced when the editor opens.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.forms.all }),
  })
}

/** Saves a form with all its questions. */
export function useSaveForm() {
  // The form service, and the cache to refresh.
  const { forms } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (draft: FormDraft) => appQuery(() => forms.saveForm(draft)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.forms.all }),
  })
}

/** Deletes a form with its questions and answers. */
export function useDeleteForm() {
  // The form service, and the cache to refresh.
  const { forms } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formId: string) => appQuery(() => forms.deleteForm(formId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.forms.all }),
  })
}

/** Deletes one answer. */
export function useDeleteResponse() {
  // The form service, and the cache to refresh.
  const { forms } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (responseId: string) => appQuery(() => forms.deleteResponse(responseId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.forms.all }),
  })
}
