/**
 * The Users screens' data (admin REQUIREMENTS section 11): the list, the details and the filter
 * choices, and the changes. Every change refreshes the user queries and the dashboard counts.
 */

// Server state, mutations, the cache, and keeping the old page while the next loads.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// The shared vocabulary.
import type { AccountStatus } from '@conote/domain'
// Turns any failure into an AppError.
import { appQuery } from '@conote/core/appQuery'

// The services.
import { useServices } from '@/services/useServices'
// User shapes.
import type { InviteUserInput, UpdateUserInput, UserFilter } from '@/types/users'

// Query keys.
import { queryKeys } from './queryKeys'

/** One page of the list. The previous page stays on screen while the next loads. */
export function useUsers(filter: UserFilter) {
  // The user service.
  const { users } = useServices()
  return useQuery({
    queryKey: queryKeys.users.list(filter),
    queryFn: () => appQuery(() => users.listUsers(filter)),
    placeholderData: keepPreviousData,
  })
}

/** The departments and courses the filters offer. */
export function useUserFilterOptions() {
  // The user service.
  const { users } = useServices()
  return useQuery({
    queryKey: queryKeys.users.filterOptions(),
    queryFn: () => appQuery(() => users.listFilterOptions()),
  })
}

/** One account's details. */
export function useUser(userId: string) {
  // The user service.
  const { users } = useServices()
  return useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => appQuery(() => users.getUser(userId)),
  })
}

/** Clears every user query and the dashboard, so lists, details and counts show the change. */
function useRefreshUsers() {
  // The query cache.
  const queryClient = useQueryClient()
  return async () => {
    // Both at once; the screens refetch what they show.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
    ])
  }
}

/**
 * The refresh for a change whose confirmation must not wait for it: it starts the reload and
 * returns at once. A mutation's own `onSuccess` is awaited before the caller's, so returning the
 * reload would hold back the "sent" toast (and a page's move away) for as long as the list takes
 * to load, which on the real backend is seconds in which nothing seems to have happened.
 */
function useRefreshInBackground() {
  // The awaited refresh, started and left to finish on its own.
  const refresh = useRefreshUsers()
  return () => {
    void refresh()
  }
}

/** Invites someone. */
export function useInviteUser() {
  // The user service, and the refresh after a change.
  const { users } = useServices()
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: (input: InviteUserInput) => appQuery(() => users.inviteUser(input)),
    onSuccess: refresh,
  })
}

/** Saves profile changes. */
export function useUpdateUser() {
  // The user service, and the refresh after a change.
  const { users } = useServices()
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: UpdateUserInput }) =>
      appQuery(() => users.updateUser(userId, input)),
    onSuccess: refresh,
  })
}

/** Activates, deactivates or suspends an account. */
export function useSetUserStatus() {
  // The user service, and the refresh after a change.
  const { users } = useServices()
  const refresh = useRefreshInBackground()
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: AccountStatus }) =>
      appQuery(() => users.setUserStatus(userId, status)),
    onSuccess: refresh,
  })
}

/** Deletes an invitation nobody has accepted. */
export function useDeleteInvitation() {
  // The user service, and the refresh after the change (the person leaves the lists).
  const { users } = useServices()
  const refresh = useRefreshInBackground()
  return useMutation({
    mutationFn: (userId: string) => appQuery(() => users.deleteInvitation(userId)),
    onSuccess: refresh,
  })
}

/** Deletes an account for good. */
export function useDeleteUser() {
  // The user service, and the refresh after the change (the person leaves the lists, and the
  // courses they were in change).
  const { users } = useServices()
  const refresh = useRefreshInBackground()
  return useMutation({
    mutationFn: (userId: string) => appQuery(() => users.deleteUser(userId)),
    onSuccess: refresh,
  })
}

/** Sends a password reset link, or an invited person's invitation again. */
export function useSendPasswordReset() {
  // The user service, and the refresh after a change (the history shows it).
  const { users } = useServices()
  const refresh = useRefreshInBackground()
  return useMutation({
    mutationFn: (userId: string) => appQuery(() => users.sendPasswordReset(userId)),
    onSuccess: refresh,
  })
}
