/**
 * Settings → Profile (FR-SET-1): picture with upload and preview, full name, read-only email,
 * department, level and phone. Save Changes shows a toast.
 */

// Connects the profile rules to the form.
import { zodResolver } from '@hookform/resolvers/zod'
// The picture being previewed and the picture's error.
import { useState } from 'react'
// Form state.
import { useForm } from 'react-hook-form'

// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Loading placeholder.
import { ListSkeleton } from '@/components/common/Skeletons'
// Labelled field and the error box.
import { FormField } from '@conote/ui/forms/FormField'
import { FormMessage } from '@conote/ui/forms/FormMessage'
// Picture, button and input.
import { Avatar, AvatarFallback } from '@conote/ui/avatar'
import { buttonVariants, Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
// Toast messages.
import { useToast } from '@/features/toast/useToast'
// Data hooks.
import { useProfile, useUpdateProfile, useUploadAvatar } from '@/hooks/useProfile'
// Picture rules.
import { avatarProblem } from '@/lib/avatar'
// Student-facing wording for errors.
import { errorMessage } from '@/lib/errorMessages'
// Normalises anything thrown.
import { toAppError } from '@conote/core/errors'
// "Victory Okafor" → "VO".
import { initials } from '@/lib/initials'
// Profile rules.
import { profileSchema, type ProfileValues } from '@/lib/profile'
// Class-name helper.
import { cn } from '@conote/ui/utils'
// The profile shape.
import type { StudentProfile } from '@/types/domain'

// The section card.
import { SettingsSection } from './SettingsSection'

/** The Profile tab. */
export function ProfileTab() {
  // The profile.
  const profile = useProfile()

  // Failed.
  if (profile.isError)
    return <LoadError error={profile.error} onRetry={() => void profile.refetch()} />
  // Loading.
  if (!profile.data) return <ListSkeleton rows={3} />
  // Loaded; keyed so a changed profile resets the form.
  return <ProfileForm key={profile.data.id} profile={profile.data} />
}

/** The form. */
function ProfileForm({ profile }: Readonly<{ profile: StudentProfile }>) {
  // Saving and uploading.
  const update = useUpdateProfile()
  const upload = useUploadAvatar()
  // Toasts.
  const toast = useToast()
  // The picture to show: a new upload, else the saved one.
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl)
  // Why the chosen picture was refused.
  const [avatarError, setAvatarError] = useState<string | null>(null)
  // The service's refusal.
  const [serverError, setServerError] = useState<string | null>(null)
  // The form, checked with the same rules as the service.
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile.fullName,
      department: profile.department ?? '',
      level: profile.level ?? '',
      phone: profile.phone ?? '',
    },
  })

  /** Checks and uploads a chosen picture, then previews it (saved with the form). */
  async function choosePicture(file: File | undefined) {
    if (!file) return
    // The same rules the service applies.
    const problem = avatarProblem(file)
    setAvatarError(problem)
    if (problem) return
    try {
      setAvatarUrl(await upload.mutateAsync(file))
    } catch (error) {
      setAvatarError(errorMessage(toAppError(error)))
    }
  }

  /** Saves the fields and the picture. */
  async function save(values: ProfileValues) {
    setServerError(null)
    try {
      await update.mutateAsync({ ...values, ...(avatarUrl ? { avatarUrl } : {}) })
      toast.success('Profile saved.')
    } catch (error) {
      setServerError(errorMessage(toAppError(error)))
    }
  }

  return (
    <SettingsSection title="Profile" description="How you appear in CoNote.">
      <form noValidate onSubmit={(event) => void handleSubmit(save)(event)} className="space-y-5">
        {serverError && <FormMessage tone="error">{serverError}</FormMessage>}

        {/* Picture: preview and a button that opens the file picker. */}
        <div className="flex items-center gap-4">
          {/* The preview is a plain image, shown at once; Radix's avatar would wait for it to load. */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Preview of how you appear"
              className="size-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Avatar className="size-16">
              <AvatarFallback className="text-lg">{initials(profile.fullName)}</AvatarFallback>
            </Avatar>
          )}
          <div className="space-y-1">
            {/* The label is the visible button; the file input itself is hidden but focusable. */}
            <label
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'cursor-pointer focus-within:ring-[3px] focus-within:ring-ring/50',
              )}
            >
              {/* The words in their own element, so the space before the input is explicit. */}
              <span>Change picture</span>
              <input
                type="file"
                aria-label="Choose a picture"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(event) => {
                  void choosePicture(event.target.files?.[0])
                  // Allow picking the same file again after an error.
                  event.target.value = ''
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">JPG or PNG, 2 MB at most.</p>
            {avatarError && <p className="text-sm text-error-strong">{avatarError}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="profile-name" label="Full name" error={errors.fullName?.message}>
            {(field) => <Input {...field} autoComplete="name" {...register('fullName')} />}
          </FormField>
          {/* Read-only here; it changes with the sign-in account. */}
          <FormField id="profile-email" label="Email address">
            {(field) => (
              <Input
                {...field}
                type="email"
                value={profile.email}
                readOnly
                className="bg-background"
              />
            )}
          </FormField>
          <FormField
            id="profile-department"
            label="Department (optional)"
            error={errors.department?.message}
          >
            {(field) => (
              <Input {...field} autoComplete="organization-title" {...register('department')} />
            )}
          </FormField>
          <FormField
            id="profile-level"
            label="Level or year (optional)"
            error={errors.level?.message}
          >
            {(field) => <Input {...field} {...register('level')} />}
          </FormField>
          <FormField id="profile-phone" label="Phone (optional)" error={errors.phone?.message}>
            {(field) => <Input {...field} type="tel" autoComplete="tel" {...register('phone')} />}
          </FormField>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </SettingsSection>
  )
}
