/**
 * Shows toasts from anywhere inside ToastProvider.
 */

// Reads the context.
import { useContext } from 'react'

// The context.
import { ToastContext } from './ToastContext'

/** The success and error toast functions. */
export function useToast() {
  // The provider's functions.
  const toast = useContext(ToastContext)
  // A missing provider is a wiring mistake; say so plainly.
  if (!toast) throw new Error('useToast must be used inside <ToastProvider>')
  return toast
}
