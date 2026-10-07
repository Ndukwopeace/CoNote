/**
 * A static picture of the student dashboard for the landing hero (FR-LND-2, open question 5),
 * drawn with plain boxes so it needs no image file and always matches the design tokens.
 */

/** Stand-in course cards: a short code and its accent colour classes. */
const PREVIEW_COURSES = [
  // Each accent is a design token (decision D14).
  { code: 'SWE 311', bar: 'bg-course-1', soft: 'bg-course-1-soft' },
  { code: 'MTH 204', bar: 'bg-course-2', soft: 'bg-course-2-soft' },
  { code: 'PHY 102', bar: 'bg-course-3', soft: 'bg-course-3-soft' },
] as const

/**
 * Desktop and phone frames showing the dashboard. role="img" with a label makes screen readers
 * announce one description instead of reading every box inside.
 */
export function DashboardPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the CoNote student dashboard on a laptop and a phone"
      className="relative mx-auto mt-14 max-w-4xl"
    >
      {/* Desktop frame. */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-lg">
        {/* Window bar with three dots. */}
        <div className="flex gap-1.5 border-b bg-muted px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-error" />
          <span className="size-2.5 rounded-full bg-warning" />
          <span className="size-2.5 rounded-full bg-success" />
        </div>
        {/* Sidebar and content side by side. */}
        <div className="flex min-h-64 text-left">
          {/* Sidebar: logo block and six navigation bars; hidden on phones to save space. */}
          <div className="hidden w-40 shrink-0 space-y-3 border-r bg-surface p-4 sm:block">
            <div className="h-5 w-20 rounded bg-primary" />
            {Array.from({ length: 6 }, (_, index) => (
              // The first bar is the "current page".
              <div
                key={index}
                className={index === 0 ? 'h-3 rounded bg-primary-light' : 'h-3 rounded bg-muted'}
              />
            ))}
          </div>
          {/* Main area: greeting and course cards. */}
          <div className="flex-1 space-y-4 p-5">
            {/* Greeting, as the real dashboard shows it. */}
            <p className="text-sm font-bold">Welcome, Victory</p>
            {/* Course cards: one column on phones, three from 640 px. */}
            <div className="grid gap-3 sm:grid-cols-3">
              {PREVIEW_COURSES.map((course) => (
                <div key={course.code} className={`space-y-2 rounded-lg p-3 ${course.soft}`}>
                  {/* Accent bar. */}
                  <div className={`h-1.5 w-10 rounded ${course.bar}`} />
                  {/* Course code. */}
                  <p className="text-xs font-semibold">{course.code}</p>
                  {/* Two lines standing for the course title. */}
                  <div className="h-2 rounded bg-surface" />
                  <div className="h-2 w-2/3 rounded bg-surface" />
                </div>
              ))}
            </div>
            {/* A "summary ready" row. */}
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <span className="size-8 shrink-0 rounded-md bg-success-soft" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2 w-1/2 rounded bg-muted" />
                <div className="h-2 w-1/3 rounded bg-muted" />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Phone frame, overlapping the bottom-right corner from 768 px up. */}
      <div className="absolute -right-4 -bottom-8 hidden w-36 rounded-[1.5rem] border-4 border-foreground/80 bg-card p-2 shadow-xl md:block">
        {/* Greeting bar. */}
        <div className="mb-2 h-3 w-16 rounded bg-primary" />
        {/* Stacked course cards. */}
        {PREVIEW_COURSES.map((course) => (
          <div key={course.code} className={`mb-2 h-10 rounded-md ${course.soft}`} />
        ))}
        {/* Bottom tab bar. */}
        <div className="flex justify-between border-t pt-2">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className="size-3 rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  )
}
