/**
 * Every TanStack Query key in the portal (ENGINEERING_STANDARDS.md 3.2). Reads and later cache
 * updates use these builders, so the two can't drift apart.
 */

/** Query keys, grouped by area. Each group's `all` key clears the whole area at once. */
export const queryKeys = {
  teaching: {
    // Every query about the teacher's courses.
    all: ['teaching'] as const,
    // The signed-in teacher's courses.
    myCourses: () => [...queryKeys.teaching.all, 'my-courses'] as const,
    // One course with its classes.
    course: (courseId: string) => [...queryKeys.teaching.all, 'course', courseId] as const,
  },
  review: {
    // Every query about summaries under review.
    all: ['review'] as const,
    // The review queue.
    queue: () => [...queryKeys.review.all, 'queue'] as const,
    // One summary opened for review.
    details: (summaryId: string) => [...queryKeys.review.all, 'details', summaryId] as const,
  },
}
