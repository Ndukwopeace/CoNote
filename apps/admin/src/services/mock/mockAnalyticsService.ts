/**
 * The demo AnalyticsService (admin REQUIREMENTS sections 10 and 20): the dashboard's counts and
 * activity series, computed from the demo platform records exactly as the database will.
 */

// Daily bucketing for the series, and local day keys for the term check.
import { dailyCounts, localDateKey } from '@/lib/activity'
// Dashboard shapes.
import type { ActivitySeriesKey } from '@/types/dashboard'

// The records it reads.
import type { ActivityEventKind, PlatformData } from '../platformData'
// The interface implemented here.
import type { AnalyticsService } from '../types'

// Fake network delay.
import { simulateLatency } from './latency'

/** What the demo service needs: the records, the clock, and how slow to pretend to be. */
interface MockAnalyticsOptions {
  data: PlatformData
  now: () => Date
  latencyMs: number
}

/** The activity event behind each series that is counted from activity_events. */
const EVENT_SERIES: Partial<Record<ActivitySeriesKey, ActivityEventKind>> = {
  notes_created: 'note_created',
  resources_opened: 'resource_opened',
  ai_questions: 'ai_question',
}

/** Builds the demo AnalyticsService over `data`. */
export function createMockAnalyticsService({
  data,
  now,
  latencyMs,
}: MockAnalyticsOptions): AnalyticsService {
  /** The times counted by `series`. */
  function timesFor(series: ActivitySeriesKey): string[] {
    // Summaries generated: AI jobs that finished successfully.
    if (series === 'summaries_generated') {
      return data.aiJobs.flatMap((job) =>
        job.status === 'succeeded' && job.finishedAt ? [job.finishedAt] : [],
      )
    }
    // Summaries published: when a teacher published them.
    if (series === 'summaries_published') {
      return data.summaries.flatMap((summary) => (summary.publishedAt ? [summary.publishedAt] : []))
    }
    // Everything else: the matching activity events.
    const kind = EVENT_SERIES[series]
    return data.activity.flatMap((event) => (event.kind === kind ? [event.at] : []))
  }

  return {
    async getOverview() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // The term's bounds, as local day keys, compared as text (YYYY-MM-DD sorts by date).
      const { termStartsOn, termEndsOn } = data.settings
      // Is `startsAt` inside the term?
      const inTerm = (startsAt: string) => {
        const day = localDateKey(new Date(startsAt))
        return day >= termStartsOn && day <= termEndsOn
      }
      // The six counts.
      return {
        students: data.users.filter((user) => user.role === 'student').length,
        teachers: data.users.filter((user) => user.role === 'teacher').length,
        activeCourses: data.courses.filter((course) => course.archivedAt === null).length,
        classesThisTerm: data.classes.filter(
          (cls) => cls.archivedAt === null && inTerm(cls.startsAt),
        ).length,
        publishedSummaries: data.summaries.filter((summary) => summary.status === 'published')
          .length,
        activeAiJobs: data.aiJobs.filter(
          (job) => job.status === 'queued' || job.status === 'running',
        ).length,
      }
    },

    async getActivitySeries(range, series) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // One point per day, ending today on the clock.
      return dailyCounts(timesFor(series), now(), range)
    },
  }
}
