/**
 * What the Classes screens show (admin REQUIREMENTS section 13). Services return these shapes;
 * pages only display them.
 */

// The shared vocabulary.
import type { AiJobStatus, SummaryStatus } from '@conote/domain'

// A person as the screens name them.
import type { PersonRef } from '@/types/courses'

/** How the list can be sorted: a field, descending when it starts with "-". */
export type ClassSort = 'date' | '-date' | 'course' | '-course' | 'title' | '-title'

/** The summary filter: a stage, or "none" for classes without a summary yet. */
export type SummaryFilter = SummaryStatus | 'none'

/** What the list shows: classes in use or archived ones, narrowed by search and filters. */
export interface ClassFilter {
  // Matches title and course code, ignoring case.
  q?: string | undefined
  courseId?: string | undefined
  summaryStatus?: SummaryFilter | undefined
  // The first and last day, as YYYY-MM-DD local dates, both inclusive.
  from?: string | undefined
  to?: string | undefined
  // True for archived classes; otherwise classes in use.
  archived?: boolean | undefined
  sort?: ClassSort | undefined
  // From 1.
  page?: number | undefined
}

/** One row of the list. */
export interface ClassListItem {
  id: string
  // Within the course, from 1.
  number: number
  courseId: string
  courseCode: string
  courseTitle: string
  title: string
  startsAt: string
  endsAt: string
  // The course's teacher.
  teacher: PersonRef | null
  // The summary's stage, or null before the class has one.
  summaryStatus: SummaryStatus | null
  // How many notes students contributed (a count, never content).
  noteCount: number
  archivedAt: string | null
}

/** One page of the list. */
export interface ClassPage {
  items: ClassListItem[]
  total: number
  page: number
  pageSize: number
}

/** One AI job in a class's history. */
export interface ClassAiJob {
  id: string
  status: AiJobStatus
  attempt: number
  createdAt: string
  finishedAt: string | null
}

/** One stage of the summary timeline. */
export interface SummaryStep {
  stage: SummaryStatus
  // When it was reached, or null if it has not been (or is not recorded).
  at: string | null
  // True once the summary has got to this stage.
  reached: boolean
}

/** Everything on the class details page. */
export interface ClassDetails extends ClassListItem {
  description: string
  // How many students are enrolled in the course.
  studentCount: number
  // Oldest first.
  aiJobs: ClassAiJob[]
  // In order: collecting, processing, in review, published.
  timeline: SummaryStep[]
}

/** What creating or editing a class needs. Date and times are local: YYYY-MM-DD and HH:MM. */
export interface ClassInput {
  courseId: string
  title: string
  date: string
  startTime: string
  endTime: string
  description: string
}

/** A course the filter or form offers. */
export interface ClassCourseOption {
  id: string
  code: string
  title: string
  // Archived courses can be filtered by but not given new classes.
  archived: boolean
}

/** The choices the filters and form offer. */
export interface ClassFilterOptions {
  // By code.
  courses: ClassCourseOption[]
}
