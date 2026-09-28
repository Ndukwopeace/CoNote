/**
 * Sets the browser tab's title for the current page.
 */

/** Sets the browser tab title. React 19 hoists <title> into the document head. */
export function PageTitle({ title }: { title: string }) {
  // "Notes · CoNote": page first, so tabs stay distinguishable when several are open.
  return <title>{`${title} · CoNote`}</title>
}
