/**
 * The ask-ai Edge Function: the thin entry Supabase runs. All the logic is in
 * ../_shared/askAi.ts, where the tests reach it. A signed-in student calls it from Ask AI.
 */

// The handler.
import { askAiHandler } from '../_shared/askAi.ts'
// The clients and settings.
import { createClients } from '../_shared/clients.ts'
import { readEnv, readModelEnv } from '../_shared/env.ts'

// The settings are read once, when the function starts; a missing one stops it with a clear error.
const get = (name: string) => Deno.env.get(name)
const env = readEnv(get)
const model = readModelEnv(get)

// Answer every request with the handler.
Deno.serve(
  askAiHandler({
    env,
    clients: createClients(env),
    now: () => new Date(),
    model: { fetch, apiKey: model.groqApiKey, model: model.groqModel },
    // Thirty questions a student a day: plenty for study, and a ceiling on what one account can
    // take from the model's shared daily allowance.
    dailyLimit: 30,
  }),
)
