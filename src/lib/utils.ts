/**
 * Class-name helper used by every component (the standard shadcn/ui `cn`).
 */

// clsx turns conditional class lists into one string.
import { clsx, type ClassValue } from 'clsx'
// tailwind-merge removes conflicting Tailwind classes, e.g. "p-2 p-4" → "p-4".
import { twMerge } from 'tailwind-merge'

/** Joins class names and resolves conflicting Tailwind classes (last one wins). */
export function cn(...inputs: ClassValue[]) {
  // Join first, then resolve conflicts, so callers can override a component's defaults.
  return twMerge(clsx(inputs))
}
