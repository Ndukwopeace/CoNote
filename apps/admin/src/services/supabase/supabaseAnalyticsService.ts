/**
 * The admin AnalyticsService on Supabase (milestone B2.8, D87): the dashboard's counts and the
 * activity chart, and the Analytics page's report and class table (D124). All come from database functions that count for an administrator and check the
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
// The Analytics page's one row of counts (D124).
const reportRow = z.object({
  students: z.number(),
  teachers: z.number(),
  new_users: z.number(),
  active_7: z.number(),
  active_30: z.number(),
  inactive: z.number(),
  courses: z.number(),
  classes: z.number(),
  notes_created: z.number(),
  summaries_generated: z.number(),
  summaries_published: z.number(),
  drafts_waiting: z.number(),
  ai_jobs_total: z.number(),
  ai_jobs_succeeded: z.number(),
  ai_jobs_failed: z.number(),
  ai_avg_seconds: z.number().nullable(),
  students_who_wrote: z.number(),
  students_expected: z.number(),
})
// One class of the participation table.
const participationRow = z.object({
  class_id: z.string(),
  class_number: z.number(),
  class_title: z.string(),
  starts_at: z.string(),
  course_id: z.string(),
  course_code: z.string(),
  notes: z.number(),
  writers: z.number(),
  enrolled: z.number(),
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

    async getReport(period) {
      // One row of counts. `p_now` is the moment the sign-in windows count back from.
      const [row] = await readRows(
        client.rpc('admin_analytics', {
          p_from: period.from,
          p_to: period.to,
          p_now: now().toISOString(),
        }),
        reportRow,
      )
      if (!row) throw fromSupabaseError({ message: 'Malformed row', cause: 'no report row' })
      return {
        users: {
          students: row.students,
          teachers: row.teachers,
          newUsers: row.new_users,
          active7: row.active_7,
          active30: row.active_30,
          inactive: row.inactive,
        },
        academic: {
          courses: row.courses,
          classes: row.classes,
          notesCreated: row.notes_created,
          summariesGenerated: row.summaries_generated,
          summariesPublished: row.summaries_published,
          draftsWaiting: row.drafts_waiting,
        },
        ai: {
          total: row.ai_jobs_total,
          succeeded: row.ai_jobs_succeeded,
          failed: row.ai_jobs_failed,
          averageSeconds: row.ai_avg_seconds,
        },
        participation: {
          studentsWhoWrote: row.students_who_wrote,
          studentsExpected: row.students_expected,
        },
      }
    },

    async getParticipation(period) {
      const rows = await readRows(
        client.rpc('admin_note_participation', { p_from: period.from, p_to: period.to }),
        participationRow,
      )
      return rows.map((row) => ({
        classId: row.class_id,
        classNumber: row.class_number,
        classTitle: row.class_title,
        startsAt: row.starts_at,
        courseId: row.course_id,
        courseCode: row.course_code,
        notes: row.notes,
        writers: row.writers,
        enrolled: row.enrolled,
      }))
    },
  }
}
