/**
 * One activity series as a line with a light wash beneath it (admin REQUIREMENTS section 10).
 * The line and wash are SVG stretched to the box; the axis labels are HTML, so text stays a
 * readable size at any width. A crosshair follows the pointer or the arrow keys and shows that
 * day's value; the same values are in the table view, so nothing depends on hovering.
 */

// Keyboard and pointer event types, and the highlighted day.
import { useState, type KeyboardEvent, type PointerEvent } from 'react'

// Class-name helper.
import { cn } from '@conote/ui/utils'

// Axis scale and date labels.
import { dayLabel, niceScale, shortDayLabel } from '@/lib/chart'
// Point shape.
import type { ActivityPoint } from '@/types/dashboard'

/** What the chart draws. */
interface ActivityChartProps {
  // One point per day, oldest first. At least two.
  points: ActivityPoint[]
  // What is counted, e.g. "Notes created".
  label: string
  // True while another range or series loads; the old chart dims instead of disappearing.
  refreshing: boolean
}

/**
 * Where the tooltip sits beside the crosshair: to its right near the start, to its left near the
 * end, and centred elsewhere, so it never spills out of the card.
 */
function tooltipAlignment(index: number, lastIndex: number) {
  // The first sixth of the days.
  if (index < lastIndex / 6) return 'translate-x-2'
  // The last sixth.
  if (index > (lastIndex * 5) / 6) return '-translate-x-full -ml-2'
  // Everywhere else.
  return '-translate-x-1/2'
}

/** One sentence describing the whole series, for screen readers. */
function summarise(points: ActivityPoint[], label: string) {
  // Total, and the busiest day (the first one, if several tie).
  const total = points.reduce((sum, point) => sum + point.count, 0)
  const peak = points.reduce((best, point) => (point.count > best.count ? point : best))
  const first = points[0]
  const last = points.at(-1)
  return `${label} per day, ${dayLabel(first?.date ?? '')} to ${dayLabel(last?.date ?? '')}: ${total} in total, most on ${dayLabel(peak.date)} (${peak.count}).`
}

/** The chart. */
export function ActivityChart({ points, label, refreshing }: Readonly<ActivityChartProps>) {
  // The day under the crosshair, or null when nothing is highlighted.
  const [active, setActive] = useState<number | null>(null)
  // The last index, which is also the SVG's width in day units.
  const lastIndex = points.length - 1
  // A round axis above the busiest day.
  const { top, ticks } = niceScale(Math.max(...points.map((point) => point.count)))

  // Where day `index` sits across the box, and where `count` sits up it, as percentages.
  const xPercent = (index: number) => (index / lastIndex) * 100
  const yPercent = (count: number) => (count / top) * 100

  // The line through every day, in SVG units (x: day index, y: 0 at the top to 100 at the base).
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${index} ${100 - yPercent(point.count)}`)
    .join(' ')
  // The wash: the line closed down to the baseline.
  const area = `${line} L${lastIndex} 100 L0 100 Z`

  /** Highlights the day nearest the pointer. */
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    // The pointer's position across the box, from 0 to 1.
    const box = event.currentTarget.getBoundingClientRect()
    // A box with no width (not laid out yet) has no days to point at.
    if (box.width === 0) return
    const ratio = (event.clientX - box.left) / box.width
    // Snap to the nearest day, kept inside the range.
    setActive(Math.min(lastIndex, Math.max(0, Math.round(ratio * lastIndex))))
  }

  /** Moves the highlight with the arrow keys, Home and End. */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // The day to move from: the highlighted one, or today.
    const from = active ?? lastIndex
    // The day each key moves to.
    const next: Record<string, number> = {
      ArrowLeft: Math.max(0, from - 1),
      ArrowRight: Math.min(lastIndex, from + 1),
      Home: 0,
      End: lastIndex,
    }
    // Other keys keep their normal meaning.
    if (!(event.key in next)) return
    // Arrows would otherwise scroll the page.
    event.preventDefault()
    setActive(next[event.key] ?? from)
  }

  // The highlighted day, if any.
  const point = active === null ? undefined : points[active]
  // The day the slider reports: the highlighted one, or today. There is always a last point.
  const shown = point ?? points[lastIndex] ?? { date: '', count: 0 }
  // Days to label under the axis: the first, the middle and the last.
  const axisDays = [0, Math.round(lastIndex / 2), lastIndex]

  return (
    // A figure named by one sentence about the whole series: the total and the busiest day.
    <figure aria-label={summarise(points, label)}>
      {/* Dimmed while another range or series loads. */}
      <div className={cn('transition-opacity', refreshing && 'opacity-60')}>
        <div className="flex gap-2">
          {/* The value axis: round numbers, decorative (the description and table carry them). */}
          <div
            aria-hidden="true"
            className="relative h-48 w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
          >
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-0 translate-y-1/2"
                style={{ bottom: `${yPercent(tick)}%` }}
              >
                {tick.toLocaleString('en-GB')}
              </span>
            ))}
          </div>
          {/* The plot. */}
          <div className="relative h-48 flex-1">
            {/* Hairline gridlines at each round number. */}
            {ticks.map((tick) => (
              <div
                key={tick}
                aria-hidden="true"
                className="absolute inset-x-0 border-t border-border"
                style={{ bottom: `${yPercent(tick)}%` }}
              />
            ))}
            {/* The wash and the 2px line, stretched to the box; the stroke keeps its width. */}
            <svg
              aria-hidden="true"
              viewBox={`0 0 ${lastIndex} 100`}
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
            >
              <path d={area} className="fill-primary/10" />
              <path
                d={line}
                vectorEffect="non-scaling-stroke"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="fill-none stroke-primary"
              />
            </svg>
            {point && active !== null && (
              <>
                {/* The crosshair. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 w-px bg-foreground/30"
                  style={{ left: `${xPercent(active)}%` }}
                />
                {/* The marker on the line, ringed in the card colour. */}
                <span
                  aria-hidden="true"
                  className="absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
                  style={{ left: `${xPercent(active)}%`, bottom: `${yPercent(point.count)}%` }}
                />
                {/* The tooltip: the value first, then the day. Kept inside the box at the edges. */}
                <div
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute -top-2 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap shadow-sm',
                    tooltipAlignment(active, lastIndex),
                  )}
                  style={{ left: `${xPercent(active)}%` }}
                >
                  <strong className="block text-sm">{point.count.toLocaleString('en-GB')}</strong>
                  <span className="text-muted-foreground">{dayLabel(point.date)}</span>
                </div>
              </>
            )}
            {/* The hit area: the whole plot, so the pointer only has to be near a day. A slider
                over the days, so the arrow keys, Home and End move the crosshair and screen
                readers announce each day's value. */}
            <div
              role="slider"
              tabIndex={0}
              aria-label={`${label}, day`}
              aria-valuemin={0}
              aria-valuemax={lastIndex}
              aria-valuenow={active ?? lastIndex}
              aria-valuetext={`${dayLabel(shown.date)}: ${shown.count}`}
              onPointerMove={onPointerMove}
              onPointerLeave={() => {
                setActive(null)
              }}
              onFocus={() => {
                setActive((current) => current ?? lastIndex)
              }}
              onBlur={() => {
                setActive(null)
              }}
              onKeyDown={onKeyDown}
              className="absolute inset-0 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </div>
        {/* Dates under the axis: the first, middle and last days. Decorative, like the values. */}
        <div aria-hidden="true" className="relative mt-2 ml-10 h-4 text-xs text-muted-foreground">
          {axisDays.map((index, position) => (
            <span
              key={index}
              className={cn(
                'absolute whitespace-nowrap',
                position === 0 && 'left-0',
                position === 1 && '-translate-x-1/2',
                position === 2 && 'right-0',
              )}
              style={position === 1 ? { left: `${xPercent(index)}%` } : undefined}
            >
              {shortDayLabel(points[index]?.date ?? '')}
            </span>
          ))}
        </div>
      </div>
    </figure>
  )
}
