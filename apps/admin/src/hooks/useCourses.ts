/**
 * The Courses screens' data (admin REQUIREMENTS section 12): the list, the details, the students
 * and the filter choices, and the changes. Every change refreshes the course queries and the
 * dashboard counts (a removed teacher raises an alert), and the user queries (course counts).
 */

// Server state, mutations, the cache, and keeping the old page while the next loads.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Turns any failure into an AppError.
import { appQuery } from '@conote/core/appQuery'

// The services.
import { useServices } from '@/services/useServices'
// Course shapes.
import type { CourseFilter, CourseInput } from '@/types/courses'

// Query keys.
import { queryKeys } from './queryKeys'

/** One page of the list. The previous page stays on screen while the next loads. */
export function useCourses(filter: CourseFilter) {
  // The course service.
  const { courses } = useServices()
  return useQuery({
    queryKey: queryKeys.courses.list(filter),
    queryFn: () => appQuery(() => courses.listCourses(filter)),
    placeholderData: keepPreviousData,
  })
}

/** The departments and active teachers the filters and forms offer. */
export function useCourseFilterOptions() {
  // The course service.
  const { courses } = useServices()
  return useQuery({
    queryKey: queryKeys.courses.filterOptions(),
    queryFn: () => appQuery(() => courses.listCourseFilterOptions()),
  })
}

/** One course's details. An empty ID loads nothing (for a form that is creating a course). */
export function useCourse(courseId: string) {
  // The course service.
  const { courses } = useServices()
  return useQuery({
    queryKey: queryKeys.courses.detail(courseId),
    queryFn: () => appQuery(() => courses.getCourse(courseId)),
    enabled: courseId !== '',
  })
}

/** A course's students, narrowed by a search. */
export function useCourseStudents(courseId: string, q: string) {
  // The course service.
  const { courses } = useServices()
  return useQuery({
    queryKey: queryKeys.courses.students(courseId, q),
    queryFn: () => appQuery(() => courses.listEnrollments(courseId, q)),
    placeholderData: keepPreviousData,
  })
}

/** Clears the course, user and dashboard queries, so lists, details and counts show the change. */
function useRefreshCourses() {
  // The query cache.
  const queryClient = useQueryClient()
  return async () => {
    // All at once; the screens refetch what they show.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
    ])
  }
}

/** Creates a course. */
export function useCreateCourse() {
  // The course service, and the refresh after a change.
  const { courses } = useServices()
  const refresh = useRefreshCourses()
  return useMutation({
    mutationFn: (input: CourseInput) => appQuery(() => courses.createCourse(input)),
    onSuccess: refresh,
  })
}

/** Saves a course's changes. */
export function useUpdateCourse() {
  // The course service, and the refresh after a change.
  const { courses } = useServices()
  const refresh = useRefreshCourses()
  return useMutation({
    mutationFn: ({ courseId, input }: { courseId: string; input: CourseInput }) =>
      appQuery(() => courses.updateCourse(courseId, input)),
    onSuccess: refresh,
  })
}

/** Archives a course. */
export function useArchiveCourse() {
  // The course service, and the refresh after a change.
  const { courses } = useServices()
  const refresh = useRefreshCourses()
  return useMutation({
    mutationFn: (courseId: string) => appQuery(() => courses.archiveCourse(courseId)),
    onSuccess: refresh,
  })
}

/** Restores an archived course. */
export function useRestoreCourse() {
  // The course service, and the refresh after a change.
  const { courses } = useServices()
  const refresh = useRefreshCourses()
  return useMutation({
    mutationFn: (courseId: string) => appQuery(() => courses.restoreCourse(courseId)),
    onSuccess: refresh,
  })
}

/** Assigns or changes the teacher. */
export function useAssignTeacher() {
  // The course service, and the refresh after a change.
  const { courses } = useServices()
  const refresh = useRefreshCourses()
  return useMutation({
    mutationFn: ({ courseId, teacherId }: { courseId: string; teacherId: string }) =>
      appQuery(() => courses.assignTeacher(courseId, teacherId)),
    onSuccess: refresh,
  })
}

/** Removes the teacher. */
export function useRemoveTeacher() {
  // The course service, and the refresh after a change.
  const { courses } = useServices()
  const refresh = useRefreshCourses()
  return useMutation({
    mutationFn: (courseId: string) => appQuery(() => courses.removeTeacher(courseId)),
    onSuccess: refresh,
  })
}

/** Previews a bulk enrolment. It changes nothing, so it refreshes nothing. */
export function useMatchStudents() {
  // The course service.
  const { courses } = useServices()
  return useMutation({
    mutationFn: ({ courseId, identifiers }: { courseId: string; identifiers: string[] }) =>
      appQuery(() => courses.matchStudents(courseId, identifiers)),
  })
}

/** Enrols students. */
export function useEnrollStudents() {
  // The course service, and the refresh after a change.
  const { courses } = useServices()
  const refresh = useRefreshCourses()
  return useMutation({
    mutationFn: ({ courseId, studentIds }: { courseId: string; studentIds: string[] }) =>
      appQuery(() => courses.enrollStudents(courseId, studentIds)),
    onSuccess: refresh,
  })
}

/** Removes a student from a course. */
export function useRemoveStudent() {
  // The course service, and the refresh after a change.
  const { courses } = useServices()
  const refresh = useRefreshCourses()
  return useMutation({
    mutationFn: ({ courseId, studentId }: { courseId: string; studentId: string }) =>
      appQuery(() => courses.removeStudent(courseId, studentId)),
    onSuccess: refresh,
  })
}
