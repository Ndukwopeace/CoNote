/**
 * ask-ai: a student asks a question about their courses and the language model answers from the
 * teacher-approved summaries and the student's own notes (student REQUIREMENTS FR-AI-3). Nothing
 * else is shown to the model: no other student's notes, no draft that is not yet published.
 */

// Checks the body and what the database sends back.
import { z } from 'zod'

// The shared steps and answers.
import { roleHandler, type FunctionDeps } from './admin.ts'
import {
  buildChatMessages,
  materialBlock,
  type ClassInfo,
  type CourseInfo,
  type OwnNote,
  type PublishedSummary,
} from './chatContext.ts'
import { json, refuse } from './http.ts'
// The call to the language model, shared with the summary pipeline.
import { askModel, type ModelSettings } from './model.ts'
import { PipelineError } from './summaryDraft.ts'

/** What the function needs besides the shared steps. */
export interface AskAiDeps extends FunctionDeps {
  // How the model is called.
  model: ModelSettings
  // How many questions one student may ask in a day.
  dailyLimit: number
}

/** The longest reply that is returned, so an answer stays a size a screen can show. */
const MAX_REPLY = 4_000

/** The longest answer the model may write, in tokens. Its reasoning counts against this too. */
const MAX_TOKENS = 1_500

/** The most of each kind of material that is read, however much the student has. */
const MAX_SUMMARIES = 30
const MAX_NOTES = 50

// SECURITY: the body is checked before anything is done with it: the ids are real UUIDs (so they
// can never carry anything into a query), and the conversation is bounded in size and shape.
const bodySchema = z
  .object({
    scope: z.enum(['all', 'course', 'class']),
    courseId: z.uuid().optional(),
    classId: z.uuid().optional(),
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z
            .string()
            .trim()
            .min(1, 'Write a question.')
            .max(2000, 'Keep each message under 2000 characters.'),
        }),
      )
      .min(1, 'Ask a question.')
      .max(20, 'This conversation is too long. Start a new one.'),
  })
  // The last message is the question being asked.
  .refine((value) => value.messages.at(-1)?.role === 'user', {
    message: 'Ask a question.',
    path: ['messages'],
  })
  // A course question names its course; a class question names its class.
  .refine((value) => value.scope !== 'course' || value.courseId !== undefined, {
    message: 'Choose a course.',
    path: ['courseId'],
  })
  .refine((value) => value.scope !== 'class' || value.classId !== undefined, {
    message: 'Choose a class.',
    path: ['classId'],
  })

// SECURITY: each shape is checked on arrival, so a row of the wrong shape is a failure, never text
// handed to the model.
const enrolmentRows = z.array(z.object({ course_id: z.string() }))
const courseRows = z.array(z.object({ id: z.string(), code: z.string(), title: z.string() }))
const classRows = z.array(
  z.object({ id: z.string(), course_id: z.string(), number: z.number(), title: z.string() }),
)
const summaryRows = z.array(
  z.object({
    class_id: z.string(),
    course_id: z.string(),
    overview: z.string(),
    key_concepts: z.array(z.object({ title: z.string(), explanation: z.string() })),
    confusion_areas: z.array(z.object({ issue: z.string(), clarification: z.string() })),
    key_topics: z.array(z.object({ name: z.string(), description: z.string() })),
  }),
)
const noteRows = z.array(
  z.object({ class_id: z.string(), title: z.string().nullable(), content_html: z.string() }),
)

/** What a student with no material is told, instead of a question going to the model. */
const NOTHING_YET =
  'You have nothing to answer from yet. Ask again once you have written notes for this course, or once your teacher has published a summary.'

/** Builds the handler. */
export function askAiHandler(deps: AskAiDeps) {
  const { service } = deps.clients

  return roleHandler(deps, 'student', bodySchema, async ({ actorId, body }) => {
    /** The answer for anything unexpected, with no detail from the failure. */
    const failed = () =>
      refuse('unknown', 'Ask AI could not answer right now. Try again in a moment.')
    const notFound = () => refuse('not_found', "We couldn't find that.")

    // 1. The courses the student is in. SECURITY: the server key bypasses Row Level Security, so
    // every read below names the student itself; nothing is trusted from the request but the
    // choice of scope, and that is checked against these courses.
    const enrolments = enrolmentRows.safeParse(
      (await service.from('enrollments').select('course_id').eq('student_id', actorId)).data,
    )
    if (!enrolments.success) return failed()
    const enrolled = enrolments.data.map((row) => row.course_id)
    // A student in no course has nothing to ask about.
    if (enrolled.length === 0) return json({ reply: NOTHING_YET })

    // 2. The scope. A course the student is not in is "not found", the same as one that does not
    // exist, so nothing is revealed about it.
    if (body.scope === 'course' && !enrolled.includes(body.courseId ?? '')) return notFound()
    const courseIds = body.scope === 'course' ? [body.courseId ?? ''] : enrolled

    // 3. The courses and classes, for labels, and to check a class question.
    const [courseAnswer, classAnswer] = await Promise.all([
      service.from('courses').select('id, code, title').in('id', courseIds),
      service
        .from('class_sessions')
        .select('id, course_id, number, title')
        .in('course_id', courseIds),
    ])
    const courses = courseRows.safeParse(courseAnswer.data)
    const classes = classRows.safeParse(classAnswer.data)
    if (!courses.success || !classes.success) return failed()
    // SECURITY: a class question is allowed only for a class of a course the student is in.
    if (
      body.scope === 'class' &&
      !classes.data.some((cls) => cls.id === body.classId && courseIds.includes(cls.course_id))
    ) {
      return notFound()
    }
    // The class a class question is about, when it is one.
    const onlyClass = body.scope === 'class' ? body.classId : undefined

    // 4. The material: published summaries of those courses, and this student's own notes.
    // SECURITY: `status = published` keeps every draft out; `student_id = actorId` keeps every
    // other student's notes out.
    let summaryQuery = service
      .from('summaries')
      .select('class_id, course_id, overview, key_concepts, confusion_areas, key_topics')
      .eq('status', 'published')
      .in('course_id', courseIds)
    let noteQuery = service
      .from('notes')
      .select('class_id, title, content_html')
      .eq('student_id', actorId)
      .in('course_id', courseIds)
    if (onlyClass !== undefined) {
      summaryQuery = summaryQuery.eq('class_id', onlyClass)
      noteQuery = noteQuery.eq('class_id', onlyClass)
    }
    const [summaryAnswer, noteAnswer] = await Promise.all([
      summaryQuery.order('published_at', { ascending: false }).limit(MAX_SUMMARIES),
      noteQuery.order('created_at', { ascending: false }).limit(MAX_NOTES),
    ])
    const summaries = summaryRows.safeParse(summaryAnswer.data)
    const notes = noteRows.safeParse(noteAnswer.data)
    if (!summaries.success || !notes.success) return failed()

    // 5. Turn the rows into the model's material. With none, answer plainly: no model call, and no
    // question counted.
    const material = materialBlock({
      courses: courses.data satisfies CourseInfo[],
      classes: classes.data.map((cls): ClassInfo => ({
        id: cls.id,
        courseId: cls.course_id,
        number: cls.number,
        title: cls.title,
      })),
      summaries: summaries.data.map((row): PublishedSummary => ({
        classId: row.class_id,
        courseId: row.course_id,
        overview: row.overview,
        keyConcepts: row.key_concepts,
        confusionAreas: row.confusion_areas,
        keyTopics: row.key_topics,
      })),
      notes: notes.data.map((row): OwnNote => ({
        classId: row.class_id,
        title: row.title,
        contentHtml: row.content_html,
      })),
    })
    if (material.empty) return json({ reply: NOTHING_YET })

    // 6. The daily limit. SECURITY: the key is shared with the summary pipeline, so one student
    // asking without end must not use it up for everyone. A count that cannot be made is a
    // refusal, never a free pass.
    const slot = await service.rpc('take_chat_slot', {
      p_user: actorId,
      p_limit: deps.dailyLimit,
      p_now: deps.now().toISOString(),
    })
    if (slot.error) return failed()
    if (slot.data !== true) {
      return refuse(
        'rate_limited',
        `You have reached today's limit of ${String(deps.dailyLimit)} questions for Ask AI. It starts again tomorrow.`,
      )
    }

    // 7. Ask the model. Any failure gives the slot back, since the student got no answer.
    /** Returns the question's slot, so a failure on our side does not cost the student one. */
    const giveBack = () =>
      service.rpc('give_back_chat_slot', { p_user: actorId, p_now: deps.now().toISOString() })
    try {
      const reply = (
        await askModel(deps.model, buildChatMessages(material.text, body.messages), {
          json: false,
          maxTokens: MAX_TOKENS,
        })
      ).trim()
      if (reply === '') throw new PipelineError('bad_output', 'The language model sent no text.')
      return json({ reply: reply.slice(0, MAX_REPLY) })
    } catch (error) {
      await giveBack()
      // A busy model is a try-again-soon answer; anything else is a fixed message, with no detail
      // from the failure (and never the key).
      if (error instanceof PipelineError && error.code === 'model_busy') {
        return refuse('rate_limited', 'Ask AI is busy right now. Try again in a minute.')
      }
      return failed()
    }
  })
}
