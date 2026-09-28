/** Sets the browser tab title. React 19 hoists <title> into the document head. */
export function PageTitle({ title }: { title: string }) {
  return <title>{`${title} · CoNote`}</title>
}
