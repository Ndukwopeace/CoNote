/**
 * Published summaries on Supabase (milestone B2). Row Level Security lets a student read only
 * summaries that a teacher has published, for courses they are in; draft text never leaves the
 * database (REQUIREMENTS section 4), so this service adds no status filter of its own.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from '@conote/supabase/ids'

// The summary and teacher shapes.
import type { Summary, Teacher } from '@/types/domain'

// The interface this implementation must satisfy.
import type { SummaryService } from '../types'

// Reads and checks rows.
import { readOne, readRows } from './rows'

// The columns of a summary the pages show.
const SUMMARY_COLUMNS =
  'id, class_id, course_id, overview, key_concepts, confusion_areas, key_topics, notes_analyzed_count, reviewed_by, published_at'

// SECURITY: a summary is checked on arrival, including the shape of its parts, so a draft saved
// in an unknown shape is refused instead of reaching a screen.
const summaryRow = z.object({
  id: z.string(),
  class_id: z.string(),
  course_id: z.string(),
  overview: z.string(),
  key_concepts: z.array(z.object({ id: z.string(), title: z.string(), explanation: z.string() })),
  confusion_areas: z.array(
    z.object({ id: z.string(), issue: z.string(), clarification: z.string() }),
  ),
  key_topics: z.array(
    z.object({ id: z.string(), name: z.string(), description: z.string().exactOptional() }),
  ),
  notes_analyzed_count: z.number(),
  reviewed_by: z.string().nullable(),
  // A published summary always has a publish time.
  published_at: z.string(),
})
// A course's teacher.
const teacherRow = z.object({
  id: z.string(),
  full_name: z.string(),
  avatar_url: z.string().nullable(),
  course_id: z.string(),
})
// A summary the student has opened.
const viewRow = z.object({ summary_id: z.string() })
// Only the ID, to check a summary can be read.
const idRow = z.object({ id: z.string() })

// Shown when the approving teacher cannot be named (the account was removed).
const STAND_IN = 'Your teacher'

/** The error for a summary that is missing or that the student may not read. */
function notFound() {
  // The same answer either way (unknown, not published, not theirs), so nothing is revealed.
  return new AppError('not_found', 'Summary not found')
}

/** Builds the Supabase summary service. */
export function createSupabaseSummaryService({
  client,
}: {
  client: SupabaseClient
}): SummaryService {
  /** Joins each summary to its course's teacher and to whether the student has opened it. */
  async function attach(rows: z.infer<typeof summaryRow>[]): Promise<Summary[]> {
    // Nothing to join onto.
    if (rows.length === 0) return []
    // The follow-up reads name only what was found.
    const courseIds = [...new Set(rows.map((row) => row.course_id))]
    const summaryIds = rows.map((row) => row.id)
    const [teachers, views] = await Promise.all([
      readRows(
        client
          .from('course_teachers')
          .select('id, full_name, avatar_url, course_id')
          .in('course_id', courseIds),
        teacherRow,
      ),
      // Row Level Security shows a student only their own views.
      readRows(
        client.from('summary_views').select('summary_id').in('summary_id', summaryIds),
        viewRow,
      ),
    ])
    const teacherByCourse = new Map(teachers.map((teacher) => [teacher.course_id, teacher]))
    const viewed = new Set(views.map((view) => view.summary_id))
    return rows.map((row): Summary => {
      const teacher = teacherByCourse.get(row.course_id)
      // The course's teacher approves its summaries; a stand-in covers a removed account.
      const reviewedBy: Teacher = teacher
        ? {
            id: teacher.id,
            fullName: teacher.full_name,
            ...(teacher.avatar_url === null ? {} : { avatarUrl: teacher.avatar_url }),
          }
        : { id: row.reviewed_by ?? '', fullName: STAND_IN }
      return {
        id: row.id,
        classId: row.class_id,
        courseId: row.course_id,
        overview: row.overview,
        keyConcepts: row.key_concepts,
        confusionAreas: row.confusion_areas,
        keyTopics: row.key_topics,
        notesAnalyzedCount: row.notes_analyzed_count,
        reviewedBy,
        publishedAt: row.published_at,
        viewedByMe: viewed.has(row.id),
      }
    })
  }

  return {
    async listPublished(filter = {}) {
      // SECURITY: a filter that is not a UUID can match nothing, and is not used in a query.
      if (filter.courseId !== undefined && !isUuid(filter.courseId)) return []
      // Newest published first.
      let query = client
        .from('summaries')
        .select(SUMMARY_COLUMNS)
        .order('published_at', { ascending: false })
      if (filter.courseId !== undefined) query = query.eq('course_id', filter.courseId)
      return attach(await readRows(query, summaryRow))
    },

    async getByClass(classId) {
      // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
      if (!isUuid(classId)) throw notFound()
      const row = await readOne(
        client.from('summaries').select(SUMMARY_COLUMNS).eq('class_id', classId).maybeSingle(),
        summaryRow,
      )
      // A class with no published summary has no visible row at all, so no draft can leak.
      if (!row) throw notFound()
      const [summary] = await attach([row])
      if (!summary) throw notFound()
      return summary
    },

    async markViewed(summaryId) {
      // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
      if (!isUuid(summaryId)) throw notFound()
      // Only a summary the student can read can be marked.
      const row = await readOne(
        client.from('summaries').select('id').eq('id', summaryId).maybeSingle(),
        idRow,
      )
      if (!row) throw notFound()
      try {
        // SECURITY: only the summary is sent. The database sets the student, and Row Level
        // Security refuses a view of a summary that is not published.
        await readRows(client.from('summary_views').insert({ summary_id: summaryId }), z.unknown())
      } catch (error) {
        if (error instanceof AppError) {
          // Already recorded: nothing more to do.
          if (error.kind === 'conflict') return
          // Unpublished since it was read.
          if (error.kind === 'forbidden') throw notFound()
        }
        throw error
      }
    },
  }
}
