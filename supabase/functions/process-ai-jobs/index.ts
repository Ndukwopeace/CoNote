/**
 * The process-ai-jobs Edge Function: the thin entry Supabase runs. All the logic is in
 * ../_shared/processJobs.ts, where the tests reach it. A scheduler calls it every minute.
 */

// The clients and settings.
import { createClients } from '../_shared/clients.ts'
import { readEnv, readPipelineEnv } from '../_shared/env.ts'
// The handler.
import { processJobsHandler } from '../_shared/processJobs.ts'

// The settings are read once, when the function starts; a missing one stops it with a clear error.
const get = (name: string) => Deno.env.get(name)
const env = readEnv(get)

// Answer every request with the handler.
Deno.serve(
  processJobsHandler({
    clients: createClients(env),
    env: readPipelineEnv(get),
    now: () => new Date(),
    fetch,
    newId: () => crypto.randomUUID(),
    // The runtime keeps the function alive until this finishes, even after the response is sent.
    background: (work) => {
      EdgeRuntime.waitUntil(work)
    },
  }),
)
