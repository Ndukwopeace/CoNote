/**
 * The admin AnalyticsService on Supabase (milestone B2.8, D87): the dashboard's counts and the
 * activity chart. Both come from database functions that count for an administrator and check the
 * caller; they return numbers and days only, never a note, a draft or a person's details.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Daily bucketing for the series: the days of the range, each starting at zero.
import { dailyCounts } from '@/lib/activity'

// Turns database failures into AppErrors.
import { fromSupabaseError } from '@conote/supabase/errors'
// Reads and checks rows.
import { readRows } from '@conote/supabase/rows'

// The interface this implementation must satisfy.
import type { AnalyticsService } from '../types'

// SECURITY: each shape is checked on arrival, so a malformed answer is refused instead of shown.
const overviewRow = z.object({
  students: z.number(),
  teachers: z.number(),
  active_courses: z.number(),
  classes_this_term: z.number(),
  published_summaries: z.number(),
  active_ai_jobs: z.number(),
})
// One day's count, as the series function returns it.
const dayRow = z.object({ day: z.string(), count: z.number() })

/** What the service needs. */
interface SupabaseAnalyticsOptions {
  // The one client the console uses.
  client: SupabaseClient
  // The clock: "today" for the chart. Tests set it; the app uses the real one.
  now?: () => Date
  // The administrator's time zone, so days follow their calendar. Tests set it.
  timeZone?: string
}

/** Builds the Supabase AnalyticsService. */
export function createSupabaseAnalyticsService({
  client,
  now = () => new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: SupabaseAnalyticsOptions): AnalyticsService {
  return {
    async getOverview() {
      // The six counts, in one call.
      const [row] = await readRows(client.rpc('admin_overview', { p_tz: timeZone }), overviewRow)
      if (!row) throw fromSupabaseError({ message: 'Malformed row', cause: 'no overview row' })
      return {
        students: row.students,
        teachers: row.teachers,
        activeCourses: row.active_courses,
        classesThisTerm: row.classes_this_term,
        publishedSummaries: row.published_summaries,
        activeAiJobs: row.active_ai_jobs,
      }
    },

    async getActivitySeries(range, series) {
      // Every day of the range, ending today, each starting at zero.
      const days = dailyCounts([], now(), range)
      const first = days[0]?.date
      const last = days.at(-1)?.date
      if (first === undefined || last === undefined) return days
      // The days that had something.
      const rows = await readRows(
        client.rpc('admin_activity_series', {
          p_series: series,
          p_from: first,
          p_to: last,
          p_tz: timeZone,
        }),
        dayRow,
      )
      const counts = new Map(rows.map((row) => [row.day, row.count]))
      return days.map((point) => ({ date: point.date, count: counts.get(point.date) ?? 0 }))
    },
  }
}
