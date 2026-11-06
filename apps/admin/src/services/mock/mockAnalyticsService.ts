/**
 * The demo AnalyticsService (admin REQUIREMENTS sections 10 and 20): the dashboard's counts and
 * activity series, computed from the demo platform records exactly as the database will.
 */

// Daily bucketing for the series, and local day keys for the term check.
import { dailyCounts, localDateKey } from '@/lib/activity'
// Analytics shapes.
import type { AnalyticsPeriod, ClassParticipation } from '@/types/analytics'
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

/** Days in milliseconds, for the activity windows. */
const DAY_MS = 86_400_000

/** The most classes the participation table holds, as in the database. */
const MAX_CLASSES = 500

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

  /** Whether the ISO time `at` is inside `period` (start included, end not). */
  function within(at: string | null, period: AnalyticsPeriod): boolean {
    return at !== null && at >= period.from && at < period.to
  }

  /** The classes that start inside `period` and are not archived, newest first. */
  function classesIn(period: AnalyticsPeriod) {
    return data.classes
      .filter((cls) => cls.archivedAt === null && within(cls.startsAt, period))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
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

    async getReport(period) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // The moment the activity windows count back from.
      const nowMs = now().getTime()
      // Students and teachers: the people the page counts.
      const people = data.users.filter((user) => user.role === 'student' || user.role === 'teacher')
      // Jobs queued inside the period, and the ones that succeeded among them.
      const jobs = data.aiJobs.filter((job) => within(job.createdAt, period))
      const done = jobs.filter((job) => job.status === 'succeeded' && job.finishedAt !== null)
      // Average seconds from queued to finished; null when none succeeded.
      const averageSeconds =
        done.length === 0
          ? null
          : done.reduce(
              (sum, job) => sum + (Date.parse(job.finishedAt ?? '') - Date.parse(job.createdAt)),
              0,
            ) /
            done.length /
            1000
      // Courses that had a class in the period, and the students enrolled in them.
      const coursesWithClasses = new Set(classesIn(period).map((cls) => cls.courseId))
      const expected = new Set(
        data.enrollments
          .filter((enrolment) => coursesWithClasses.has(enrolment.courseId))
          .map((enrolment) => enrolment.studentId),
      )
      // Did this account sign in within the last `days` days?
      const signedInWithin = (lastActiveAt: string | null, days: number) =>
        lastActiveAt !== null && Date.parse(lastActiveAt) >= nowMs - days * DAY_MS
      return {
        users: {
          students: data.users.filter((user) => user.role === 'student').length,
          teachers: data.users.filter((user) => user.role === 'teacher').length,
          newUsers: people.filter((user) => within(user.createdAt, period)).length,
          active7: people.filter((user) => signedInWithin(user.lastActiveAt, 7)).length,
          active30: people.filter((user) => signedInWithin(user.lastActiveAt, 30)).length,
          inactive: people.filter(
            (user) => user.status === 'active' && !signedInWithin(user.lastActiveAt, 30),
          ).length,
        },
        academic: {
          courses: data.courses.filter((course) => course.archivedAt === null).length,
          classes: classesIn(period).length,
          notesCreated: data.notes.filter((note) => within(note.createdAt, period)).length,
          summariesGenerated: data.aiJobs.filter(
            (job) => job.status === 'succeeded' && within(job.finishedAt, period),
          ).length,
          summariesPublished: data.summaries.filter((summary) =>
            within(summary.publishedAt, period),
          ).length,
          draftsWaiting: data.summaries.filter((summary) => summary.status === 'in_review').length,
        },
        ai: {
          total: jobs.length,
          succeeded: jobs.filter((job) => job.status === 'succeeded').length,
          failed: jobs.filter((job) => job.status === 'failed').length,
          averageSeconds,
        },
        participation: {
          studentsWhoWrote: new Set(
            data.notes
              .filter((note) => within(note.createdAt, period))
              .map((note) => note.studentId),
          ).size,
          studentsExpected: expected.size,
        },
      }
    },

    async getParticipation(period) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      return classesIn(period)
        .slice(0, MAX_CLASSES)
        .map((cls): ClassParticipation => {
          // The notes of this class, and the course it belongs to.
          const notes = data.notes.filter((note) => note.classId === cls.id)
          const course = data.courses.find((item) => item.id === cls.courseId)
          return {
            classId: cls.id,
            classNumber: cls.number,
            classTitle: cls.title,
            startsAt: cls.startsAt,
            courseId: cls.courseId,
            courseCode: course?.code ?? '',
            notes: notes.length,
            writers: new Set(notes.map((note) => note.studentId)).size,
            enrolled: data.enrollments.filter((enrolment) => enrolment.courseId === cls.courseId)
              .length,
          }
        })
    },
  }
}
