/**
 * The current time, refreshed every minute, so Live, Upcoming and Completed badges follow the
 * clock while a page stays open (M3 "done when").
 */

// State for the time, and the effect that runs the timer.
import { useEffect, useState } from 'react'

/** How often the time refreshes. Class times are to the minute, so a minute is enough. */
const TICK_MS = 60_000

/** The current time, updated every minute. */
export function useNow(): Date {
  // Starts at the moment of the first render.
  const [now, setNow] = useState(() => new Date())

  // One interval for the component's lifetime.
  useEffect(() => {
    // Replace the time each minute.
    const timer = setInterval(() => {
      setNow(new Date())
    }, TICK_MS)
    // Stop the timer when the page closes.
    return () => {
      clearInterval(timer)
    }
  }, [])

  // The latest time.
  return now
}
