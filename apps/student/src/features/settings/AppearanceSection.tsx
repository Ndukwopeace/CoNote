/**
 * Settings → Appearance (D104): light or dark, kept on this device.
 */

// The light/dark choice.
import { useTheme } from '@/features/theme/useTheme'
// The two themes.
import { THEMES, type Theme } from '@/lib/theme'
// Class-name helper.
import { cn } from '@conote/ui/utils'

// The section card.
import { SettingsSection } from './SettingsSection'

/** The words on the two buttons. */
const LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark' }

/** The Appearance section. */
export function AppearanceSection() {
  // The theme in use, and the way to change it.
  const { theme, setTheme } = useTheme()

  return (
    <SettingsSection title="Appearance" description="Light or dark. Kept on this device.">
      {/* A group, so screen readers announce the two buttons as one choice. */}
      <fieldset className="flex w-fit gap-0.5 rounded-full border bg-card p-1">
        <legend className="sr-only">Theme</legend>
        {THEMES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={theme === option}
            onClick={() => {
              setTheme(option)
            }}
            className={cn(
              'min-h-10 rounded-full px-6 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              theme === option ? 'bg-muted text-foreground' : 'text-muted-foreground',
            )}
          >
            {LABELS[option]}
          </button>
        ))}
      </fieldset>
    </SettingsSection>
  )
}
