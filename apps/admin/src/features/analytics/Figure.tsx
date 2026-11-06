/**
 * One number on the Analytics page: a label, the value and, where it helps, a short note. Unlike
 * the dashboard's stat cards it links nowhere. A figure with no source yet says "Not tracked yet"
 * instead of showing 0 (admin REQUIREMENTS section 16).
 */

/** What a figure shows. */
interface FigureProps {
  // What is counted, e.g. "Students who wrote".
  label: string
  // The value; null when nothing measures it yet.
  value: number | string | null
  // A short line under the label, e.g. the period it covers.
  note?: string
}

/** A card with a big number. */
export function Figure({ label, value, note }: Readonly<FigureProps>) {
  return (
    <div className="rounded-xl border bg-card p-4">
      {/* The number, or the honest "not tracked". */}
      <p
        className={
          value === null ? 'text-base font-medium text-muted-foreground' : 'text-2xl font-bold'
        }
      >
        {value ?? 'Not tracked yet'}
      </p>
      {/* The label. */}
      <p className="text-sm text-muted-foreground">{label}</p>
      {/* The note. */}
      {note !== undefined && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}
