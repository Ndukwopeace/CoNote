/**
 * Small name helpers for avatars and greetings.
 */

/** Splits a name into words, ignoring extra spaces. */
function words(name: string) {
  // Trim the ends, split on any run of whitespace, and drop empty pieces.
  return name.trim().split(/\s+/).filter(Boolean)
}

/** "Victory Okafor" → "VO". Uses the first and last word; "?" for a blank name. */
export function initials(name: string) {
  // All words in the name.
  const parts = words(name)
  // The first word, if there is one.
  const first = parts[0]
  // A blank name still needs something in the avatar circle.
  if (first === undefined) return '?'
  // The last word, but only when there is more than one word.
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined
  // First letters, upper-cased.
  return `${first.charAt(0)}${last?.charAt(0) ?? ''}`.toUpperCase()
}

/** "Victory Okafor" → "Victory". Used in the dashboard greeting. */
export function firstName(name: string) {
  // The first word, or an empty string for a blank name.
  return words(name)[0] ?? ''
}
