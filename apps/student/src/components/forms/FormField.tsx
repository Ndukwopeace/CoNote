/**
 * A labelled form field with its inline error (FR-AUTH-3). Every form uses it, so labels,
 * errors and their screen-reader wiring look and work the same everywhere.
 */

// Types for the render function and the optional extra content.
import type { ReactNode } from 'react'

// Class-name helper.
import { cn } from '@conote/ui/utils'

/** The attributes the field hands to its input. */
export interface FieldControlProps {
  // Ties the input to the label.
  id: string
  // "true" while there is an error, so screen readers say "invalid" and the input turns red.
  'aria-invalid'?: true
  // Points at the error text, so it is read out with the input.
  'aria-describedby'?: string
}

/** What a field shows. */
interface FormFieldProps {
  // The input's id; the error's id is built from it.
  id: string
  // The visible label.
  label: string
  // The current error message, if any.
  error?: string | undefined
  // Anything next to the label, such as the "Forgot password?" link.
  labelAside?: ReactNode
  // Extra classes for the wrapper.
  className?: string
  // Renders the input with the attributes above.
  children: (control: FieldControlProps) => ReactNode
}

/** A label, the input the caller renders, and the error underneath. */
export function FormField({
  id,
  label,
  error,
  labelAside,
  className,
  children,
}: Readonly<FormFieldProps>) {
  // The error paragraph's id.
  const errorId = `${id}-error`
  // Wiring for the input: always the id, plus the error attributes only while there is an error.
  const control: FieldControlProps = error
    ? { id, 'aria-invalid': true, 'aria-describedby': errorId }
    : { id }

  return (
    // Label, input and error stacked with small gaps.
    <div className={cn('space-y-1.5', className)}>
      {/* Label row: the label, plus optional content on the right. */}
      <div className="flex items-center justify-between gap-2">
        {/* htmlFor ties the label to the input, for screen readers and a bigger click target. */}
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {/* Optional extra, such as a link. */}
        {labelAside}
      </div>
      {/* The caller's input, wired up. */}
      {children(control)}
      {/* The inline error, only when there is one. */}
      {error && (
        <p id={errorId} className="text-sm text-error-strong">
          {error}
        </p>
      )}
    </div>
  )
}
