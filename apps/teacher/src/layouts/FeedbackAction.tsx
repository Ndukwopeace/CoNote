/**
 * The teacher portal's feedback button (D125): the shared button, given the app's feedback service.
 * It sits in the top bar through the frame's `topBarExtra` slot.
 */

// The shared button.
import { FeedbackButton } from '@conote/portal'
// The services.
import { useServices } from '@/services/useServices'

/** The feedback button for the top bar. */
export function FeedbackAction() {
  // The app's feedback service.
  const { feedback } = useServices()
  return <FeedbackButton service={feedback} />
}
