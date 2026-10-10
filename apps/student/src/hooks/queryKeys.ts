/**
 * Every TanStack Query key (ENGINEERING_STANDARDS.md 3.2). Reads and, from M4, cache updates
 * after a save use these builders, so the two can't drift apart.
 */

// Identifier and filter types used in keys.
import type { NoteFilter } from '@/services/types'

/** Query keys, grouped by area. Each group's `all` key clears the whole area at once. */
export const queryKeys = {
  courses: {
    // Every course query.
    all: ['courses'] as const,
    // The enrolled course list.
    list: () => [...queryKeys.courses.all, 'list'] as const,
    // One course.
    detail: (courseId: string) => [...queryKeys.courses.all, 'detail', courseId] as const,
  },
  enrolment: {
    // Every query about joining courses; cleared after a request is made or withdrawn. Not kept
    // for offline reading: a student's requests are not course content (lib/offlineCache.ts).
    all: ['enrolment'] as const,
    // The courses the student could join, narrowed by a search.
    joinable: (query: string) => [...queryKeys.enrolment.all, 'joinable', query] as const,
    // The student's pending and declined requests.
    requests: () => [...queryKeys.enrolment.all, 'requests'] as const,
  },
  classes: {
    // Every class query.
    all: ['classes'] as const,
    // One course's classes.
    byCourse: (courseId: string) => [...queryKeys.classes.all, 'course', courseId] as const,
    // Every class of every enrolled course.
    mine: () => [...queryKeys.classes.all, 'mine'] as const,
    // One class.
    detail: (classId: string) => [...queryKeys.classes.all, 'detail', classId] as const,
  },
  notes: {
    // Every note query; M4 invalidates this after a save or delete.
    all: ['notes'] as const,
    // A filtered note list. The filter object is part of the key, so each filter caches apart.
    list: (filter: NoteFilter = {}) => [...queryKeys.notes.all, 'list', filter] as const,
    // One note.
    detail: (noteId: string) => [...queryKeys.notes.all, 'detail', noteId] as const,
  },
  summaries: {
    // Every summary query.
    all: ['summaries'] as const,
    // One class's published summary.
    byClass: (classId: string) => [...queryKeys.summaries.all, 'class', classId] as const,
    // Published summaries, optionally for one course.
    published: (courseId?: string) =>
      [...queryKeys.summaries.all, 'published', courseId ?? 'all'] as const,
  },
  profile: {
    // Every profile query.
    all: ['profile'] as const,
    // The signed-in student's profile.
    me: () => [...queryKeys.profile.all, 'me'] as const,
  },
  notifications: {
    // Every notification query.
    all: ['notifications'] as const,
    // The list.
    list: () => [...queryKeys.notifications.all, 'list'] as const,
    // The bell's count.
    unreadCount: () => [...queryKeys.notifications.all, 'unread-count'] as const,
  },
}
