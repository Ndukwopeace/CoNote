function words(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)
}

/** "Victory Okafor" → "VO". Uses the first and last word; "?" for a blank name. */
export function initials(name: string) {
  const parts = words(name)
  const first = parts[0]
  if (first === undefined) return '?'
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined
  return `${first.charAt(0)}${last?.charAt(0) ?? ''}`.toUpperCase()
}

export function firstName(name: string) {
  return words(name)[0] ?? ''
}
