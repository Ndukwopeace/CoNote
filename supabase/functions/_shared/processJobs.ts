/**
 * process-ai-jobs: the summary pipeline's worker. A scheduler calls it every minute with a secret
 * token. Each run queues a job for every class that has ended, then claims jobs one at a time,
 * reads the class's notes, asks the language model for a draft and stores it for the teacher to
 * review. A failure is recorded on the job with a short safe message; the database retries a job
 * up to three times before it stays failed for an administrator.
 *
 * PRIVACY: only the text of the notes and the class and course titles reach the model. Nothing
 * that names a student is sent, and nothing the model sends back is trusted: it is checked, and a
 * teacher reads every draft before a student can.
 */

// Checks what the database sends back.
import { z } from 'zod'

// The shared steps and answers.
import type { Clients } from './clients.ts'
import type { PipelineEnv } from './env.ts'
import { json, refuse } from './http.ts'
// The call to the language model, shared with Ask AI.
import { askModel } from './model.ts'
// The pure parts: notes to text, the instructions, and the answer's checks.
import {
  PipelineError,
  buildMessages,
  notesBlock,
  parseDraft,
  type NoteInput,
} from './summaryDraft.ts'

/** The most jobs one run takes on, so a run ends well inside the platform's time limit. */
const MAX_JOBS_PER_RUN = 3

/** A run starts no new job after this long, for the same reason. */
const RUN_BUDGET_MS = 100_000

/** How many times a job is tried before it is failed for good. */
const MAX_ATTEMPTS = 3

/** The most notes read for one class. */
const MAX_NOTES = 200

/** What the handler needs. */
export interface PipelineDeps {
  // Only the server-key client is used.
  clients: Pick<Clients, 'service'>
  env: PipelineEnv
  now: () => Date
  // The network call, so tests need no network.
  fetch: typeof fetch
  // Makes the IDs of draft items.
  newId: () => string
  // Keeps `work` running after the response has been sent (the runtime's `waitUntil`).
  background: (work: Promise<unknown>) => void
}

/** What a run did: how many jobs it queued and how each of the ones it took on ended. */
export type RunResult =
  | { ok: true; queued: number; succeeded: number; retried: number; failed: number }
  | { ok: false; reason: string }

// SECURITY: what the database sends back is checked, not trusted, like everything else here.
const claimedSchema = z.array(
  z.object({
    job_id: z.string(),
    class_id: z.string(),
    class_title: z.string(),
    course_title: z.string(),
  }),
)
const notesSchema = z.array(z.object({ title: z.string().nullable(), content_html: z.string() }))
const countSchema = z.number().int().nonnegative()

/** A job the database handed out. */
type ClaimedJob = z.infer<typeof claimedSchema>[number]

/** The bearer token in the request, or null. */
function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '')
  return match?.[1] ?? null
}

/** True when `a` equals `b`, taking the same time whatever the first difference is. */
function sameSecret(a: string, b: string): boolean {
  // SECURITY: a comparison that stops at the first difference leaks, by its timing, how much of a
  // guess was right. This one looks at every byte of the longer value.
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  let difference = left.length ^ right.length
  for (let position = 0; position < Math.max(left.length, right.length); position += 1) {
    difference |= (left[position] ?? 0) ^ (right[position] ?? 0)
  }
  return difference === 0
}

/** Builds the handler. */
export function processJobsHandler(deps: PipelineDeps) {
  const { service } = deps.clients

  /** Reads a class's notes. Only text is taken: no student ID is read, so none can be sent. */
  async function readNotes(classId: string): Promise<NoteInput[]> {
    const { data, error } = await service
      .from('notes')
      .select('title, content_html')
      .eq('class_id', classId)
      .order('created_at')
      .limit(MAX_NOTES)
    const rows = notesSchema.safeParse(data)
    if (error || !rows.success) throw new PipelineError('database', 'The notes could not be read.')
    return rows.data.map((row) => ({ title: row.title, contentHtml: row.content_html }))
  }

  /** Writes the draft for `job`, or throws the failure to record. */
  async function work(job: ClaimedJob): Promise<void> {
    const notes = notesBlock(await readNotes(job.class_id))
    if (notes.count === 0) {
      throw new PipelineError('no_notes', 'The class has no notes with text.')
    }
    // The draft must be one JSON object, and long enough to hold it.
    const answer = await askModel(
      { fetch: deps.fetch, apiKey: deps.env.groqApiKey, model: deps.env.groqModel },
      buildMessages(job.course_title, job.class_title, notes.text),
      { json: true, maxTokens: 2500 },
    )
    const draft = parseDraft(answer, deps.newId)
    // The database checks the draft again, with the same rules the review form uses.
    const { error } = await service.rpc('finish_ai_job', {
      p_job: job.job_id,
      p_overview: draft.overview,
      p_key_concepts: draft.keyConcepts,
      p_confusion_areas: draft.confusionAreas,
      p_key_topics: draft.keyTopics,
      p_now: deps.now().toISOString(),
    })
    if (error) throw new PipelineError('database', 'The draft could not be saved.')
  }

  /** Records a failed attempt. Returns whether the job will be tried again. */
  async function fail(job: ClaimedJob, failure: PipelineError): Promise<boolean> {
    const answer = await service.rpc('fail_ai_job', {
      p_job: job.job_id,
      p_code: failure.code,
      p_message: failure.message,
      p_max_attempts: MAX_ATTEMPTS,
      p_now: deps.now().toISOString(),
    })
    return answer.data === 'queued'
  }

  /**
   * One run: queues jobs for the classes that have ended, then works through up to three. It
   * never throws: a failure to queue or claim ends the run with a reason, and the scheduler's
   * next call tries again.
   */
  async function run(): Promise<RunResult> {
    const started = deps.now().getTime()
    // 1. Queue a job for every class that has ended.
    const queued = await service.rpc('queue_summary_jobs', { p_now: deps.now().toISOString() })
    if (queued.error) return { ok: false, reason: 'Jobs could not be queued.' }
    // 2. Work through the queue.
    let succeeded = 0
    let retried = 0
    let failed = 0
    for (let taken = 0; taken < MAX_JOBS_PER_RUN; taken += 1) {
      if (deps.now().getTime() - started > RUN_BUDGET_MS) break
      const claimed = await service.rpc('claim_ai_job', {
        p_now: deps.now().toISOString(),
        p_max_attempts: MAX_ATTEMPTS,
      })
      if (claimed.error) return { ok: false, reason: 'A job could not be claimed.' }
      const jobs = claimedSchema.safeParse(claimed.data ?? [])
      if (!jobs.success) return { ok: false, reason: 'A job could not be read.' }
      const job = jobs.data[0]
      // Nothing left to do.
      if (job === undefined) break
      try {
        await work(job)
        succeeded += 1
      } catch (error) {
        // A failure we know is recorded as it is; anything else gets a message that says nothing.
        const failure =
          error instanceof PipelineError
            ? error
            : new PipelineError('unknown', 'Something went wrong. It will be tried again.')
        if (await fail(job, failure)) retried += 1
        else failed += 1
      }
    }
    const count = countSchema.safeParse(queued.data)
    return { ok: true, queued: count.success ? count.data : 0, succeeded, retried, failed }
  }

  return (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return Promise.resolve(refuse('validation', 'Use POST.'))
    // SECURITY: only the scheduler, which knows the token, may start a run.
    const token = bearerToken(request)
    if (token === null || !sameSecret(token, deps.env.pipelineToken)) {
      return Promise.resolve(refuse('unauthorized', 'Not allowed.'))
    }
    // The scheduler gives up after a few seconds, and a run waits on the language model for much
    // longer. The work continues in the background and the answer goes back at once; what the
    // run did is on the jobs themselves.
    deps.background(run())
    return Promise.resolve(json({ accepted: true }, 202))
  }
}
