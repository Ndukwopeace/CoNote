/**
 * Reading a page's tab from the address (?tab=), for Course Details and Class (section 7.2).
 */

/**
 * The tab named by `value` if it is one of `tabs`, otherwise the first tab.
 * SECURITY: only known names come back, so a crafted ?tab= value can't select a tab that
 * doesn't exist or reach the page as text.
 */
export function parseTab<T extends string>(value: string | null, tabs: readonly [T, ...T[]]): T {
  // Exact match against the known names.
  const match = tabs.find((tab) => tab === value)
  // Known tab, or the default.
  return match ?? tabs[0]
}
