/**
 * Notes (D123): an administrator searches students' notes by course, class and student. The course
 * and class are kept in the address, so a search can be shared and a class's page can link here.
 * Each use is recorded in the audit log by the database, which the page says.
 */

// Reading and writing the address's query.
import { useSearchParams } from 'react-router'

// The tab title, and the drop-down.
import { PageTitle } from '@conote/ui/common/PageTitle'
import { NativeSelect } from '@conote/ui/native-select'

// The notes screen both staff portals share.
import { NotesExplorer } from '@conote/portal/notes'
// The course choices, and the classes of the chosen course.
import { useClassFilterOptions, useCourseClasses } from '@/hooks/useClasses'
// The services.
import { useServices } from '@/services/useServices'

/** Notes. */
export function NotesPage() {
  // The address's query holds the course and the class.
  const [params, setParams] = useSearchParams()
  const courseId = params.get('courseId') ?? undefined
  const classId = params.get('classId') ?? undefined
  // The note reading service, the courses, and the classes of the chosen course.
  const { notes } = useServices()
  const courses = useClassFilterOptions()
  const classes = useCourseClasses(courseId)

  /** Changes the course (and forgets the class, which belongs to the old one). */
  function chooseCourse(value: string) {
    setParams(value === '' ? {} : { courseId: value })
  }
  /** Changes the class, keeping the course. */
  function chooseClass(value: string) {
    setParams({ ...(courseId ? { courseId } : {}), ...(value === '' ? {} : { classId: value }) })
  }

  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title="Notes" />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Notes</h1>
        <p className="text-sm text-muted-foreground">
          What students wrote, with their names. Choose a course and a class, or search for a
          student. Each time you open notes is recorded in the audit log.
        </p>
      </div>
      {/* Course and class. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid w-full gap-1 text-sm sm:w-auto">
          <label htmlFor="notes-course" className="font-medium">
            Course
          </label>
          <NativeSelect
            id="notes-course"
            value={courseId ?? ''}
            onChange={(event) => {
              chooseCourse(event.target.value)
            }}
            className="sm:w-64"
          >
            <option value="">All courses</option>
            {courses.data?.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} {course.title}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid w-full gap-1 text-sm sm:w-auto">
          <label htmlFor="notes-class" className="font-medium">
            Class
          </label>
          <NativeSelect
            id="notes-class"
            value={classId ?? ''}
            disabled={courseId === undefined}
            onChange={(event) => {
              chooseClass(event.target.value)
            }}
            className="sm:w-64"
          >
            <option value="">
              {courseId === undefined ? 'Choose a course first' : 'All classes'}
            </option>
            {classes.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {`Class ${String(item.number)}: ${item.title}`}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {/* The counts for a class, who has not written, and the notes. A new key starts a new search. */}
      <NotesExplorer
        key={`${courseId ?? ''}|${classId ?? ''}`}
        service={notes}
        courseId={courseId}
        classId={classId}
        showWhere={classId === undefined}
      />
    </div>
  )
}
