/**
 * Settings → Notifications (FR-SET-3): in-app and email switches for new summaries, class
 * reminders and announcements.
 */

// The switches' working copy.
import { useState } from 'react'

// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Loading placeholder.
import { ListSkeleton } from '@/components/common/Skeletons'
// Standard button.
import { Button } from '@/components/ui/button'
// Toast messages.
import { useToast } from '@/features/toast/useToast'
// Data hooks.
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
// Shapes.
import type { NotificationPrefs } from '@/types/domain'

// The section card.
import { SettingsSection } from './SettingsSection'

/** The three kinds of notification, with their labels. */
const KINDS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: 'summaryPublished', label: 'New summary published' },
  { key: 'classReminders', label: 'Class reminders' },
  { key: 'announcements', label: 'Announcements' },
]

/** The Notifications tab. */
export function NotificationSettingsTab() {
  // The profile, which holds the settings.
  const profile = useProfile()

  // Failed.
  if (profile.isError)
    return <LoadError error={profile.error} onRetry={() => void profile.refetch()} />
  // Loading.
  if (!profile.data) return <ListSkeleton rows={3} />
  // Loaded.
  return <NotificationSwitches initial={profile.data.notificationPrefs} />
}

/** The switch table and Save. */
function NotificationSwitches({ initial }: Readonly<{ initial: NotificationPrefs }>) {
  // Saving.
  const update = useUpdateProfile()
  // Toasts.
  const toast = useToast()
  // The switches as the student has set them.
  const [prefs, setPrefs] = useState(initial)

  /** Flips one switch. */
  function toggle(key: keyof NotificationPrefs, channel: 'inApp' | 'email') {
    setPrefs((current) => ({
      ...current,
      [key]: { ...current[key], [channel]: !current[key][channel] },
    }))
  }

  return (
    <SettingsSection
      title="Notifications"
      description="Choose what CoNote tells you about, and where."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          update.mutate(
            { notificationPrefs: prefs },
            {
              onSuccess: () => {
                toast.success('Notification settings saved.')
              },
              onError: () => {
                toast.error("Couldn't save your notification settings. Try again.")
              },
            },
          )
        }}
        className="space-y-4"
      >
        <ul className="divide-y rounded-lg border">
          {KINDS.map(({ key, label }) => (
            <li
              key={key}
              className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium">{label}</span>
              <span className="flex gap-6">
                {(['inApp', 'email'] as const).map((channel) => (
                  <Switch
                    key={channel}
                    label={channel === 'inApp' ? 'In app' : 'Email'}
                    name={`${label}: ${channel === 'inApp' ? 'in app' : 'email'}`}
                    checked={prefs[key][channel]}
                    onChange={() => {
                      toggle(key, channel)
                    }}
                  />
                ))}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </SettingsSection>
  )
}

/**
 * An on/off switch: a native checkbox with the switch role, so it works with the keyboard and
 * screen readers say "on" or "off". The track and knob are drawn from the checkbox's state.
 */
function Switch({
  label,
  name,
  checked,
  onChange,
}: Readonly<{ label: string; name: string; checked: boolean; onChange: () => void }>) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        role="switch"
        aria-label={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      {/* The track; the knob moves right when on. Filled when on, so not by colour alone. */}
      <span
        aria-hidden="true"
        className="relative h-6 w-10 rounded-full border bg-background transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 after:absolute after:top-0.5 after:left-0.5 after:size-4.5 after:rounded-full after:bg-muted-foreground after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:bg-primary-foreground"
      />
      {/* The short visible label. */}
      <span aria-hidden="true">{label}</span>
    </label>
  )
}
