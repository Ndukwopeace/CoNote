/**
 * The ID check every Supabase service shares. Database IDs are UUIDs, and a value that is not one
 * is turned away before it reaches the database.
 */

// Eight, four, four, four and twelve hexadecimal digits, joined by hyphens, and nothing else.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * True when `id` looks like a database ID. SECURITY: an ID from a URL or a form is untrusted. A
 * malformed one is refused here, so it can never be built into a filter (filter injection) and
 * the database never has to answer with an "invalid input" error that shows how it is built.
 */
export function isUuid(id: string): boolean {
  // The whole text must match, so extra characters before or after fail.
  return UUID.test(id)
}
