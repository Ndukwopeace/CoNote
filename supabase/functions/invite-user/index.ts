/**
 * The invite-user Edge Function: the thin entry Supabase runs. All the logic is in
 * ../_shared/inviteUser.ts, where the tests reach it.
 */

// The clients and settings.
import { createClients } from '../_shared/clients.ts'
import { readEnv } from '../_shared/env.ts'
// The handler.
import { inviteUserHandler } from '../_shared/inviteUser.ts'

// The settings are read once, when the function starts; a missing one stops it with a clear error.
const env = readEnv((name) => Deno.env.get(name))

// Answer every request with the handler.
Deno.serve(inviteUserHandler({ env, clients: createClients(env), now: () => new Date() }))
