/**
 * A countdown for a button that may only be pressed again after a wait, such as asking for a new
 * code (the service limits how often an email goes out).
 */

// State, the timer effect and a stable starter.
import { useCallback, useEffect, useState } from 'react'

/** Counts down from `seconds` once `start()` is called; `remaining` is 0 when the wait is over. */
export function useCooldown(seconds: number) {
  // Seconds left; 0 means the button may be pressed.
  const [remaining, setRemaining] = useState(0)

  // Tick once a second while there is time left.
  useEffect(() => {
    // Nothing to count.
    if (remaining <= 0) return
    // One second later, one second less.
    const timer = setTimeout(() => {
      setRemaining(remaining - 1)
    }, 1000)
    // Stop the timer if the page closes or the count changes first.
    return () => {
      clearTimeout(timer)
    }
  }, [remaining])

  // Begins the wait.
  const start = useCallback(() => {
    setRemaining(seconds)
  }, [seconds])

  // The time left and the starter.
  return { remaining, start }
}
