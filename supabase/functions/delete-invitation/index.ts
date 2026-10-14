/**
 * The delete-invitation Edge Function: the thin entry Supabase runs. All the logic is in
 * ../_shared/deleteInvitation.ts, where the tests reach it.
 */

// The clients and settings.
import { createClients } from '../_shared/clients.ts'
// The handler.
import { deleteInvitationHandler } from '../_shared/deleteInvitation.ts'
import { readEnv } from '../_shared/env.ts'

// The settings are read once, when the function starts; a missing one stops it with a clear error.
const env = readEnv((name) => Deno.env.get(name))

// Answer every request with the handler.
Deno.serve(deleteInvitationHandler({ env, clients: createClients(env), now: () => new Date() }))
