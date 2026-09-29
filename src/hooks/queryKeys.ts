/**
 * Every TanStack Query key (ENGINEERING_STANDARDS.md 3.2). Reads and, from M4, cache updates
 * after a save use these builders, so the two can't drift apart.
 */

// Identifier and filter types used in keys.
import type { NoteFilter } from '@/services/types'
import type { ID } from '@/types/domain'

/** Query keys, grouped by area. Each group's `all` key clears the whole area at once. */
export const queryKeys = {
  courses: {
    // Every course query.
    all: ['courses'] as const,
    // The enrolled course list.
    list: () => [...queryKeys.courses.all, 'list'] as const,
    // One course.
    detail: (courseId: ID) => [...queryKeys.courses.all, 'detail', courseId] as const,
  },
  classes: {
    // Every class query.
    all: ['classes'] as const,
    // One course's classes.
    byCourse: (courseId: ID) => [...queryKeys.classes.all, 'course', courseId] as const,
    // Every class of every enrolled course.
    mine: () => [...queryKeys.classes.all, 'mine'] as const,
    // One class.
    detail: (classId: ID) => [...queryKeys.classes.all, 'detail', classId] as const,
  },
  notes: {
    // Every note query; M4 invalidates this after a save or delete.
    all: ['notes'] as const,
    // A filtered note list. The filter object is part of the key, so each filter caches apart.
    list: (filter: NoteFilter = {}) => [...queryKeys.notes.all, 'list', filter] as const,
    // One note.
    detail: (noteId: ID) => [...queryKeys.notes.all, 'detail', noteId] as const,
  },
  summaries: {
    // Every summary query.
    all: ['summaries'] as const,
    // Published summaries, optionally for one course.
    published: (courseId?: ID) =>
      [...queryKeys.summaries.all, 'published', courseId ?? 'all'] as const,
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
