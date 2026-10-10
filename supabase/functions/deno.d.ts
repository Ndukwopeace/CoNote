// The small part of Deno's API the entry points use. The functions run in Supabase's Deno-based
// runtime; the rest of the code here is plain TypeScript that Node tooling checks and tests.
declare const Deno: {
  // Starts an HTTP server that answers each request with `handler`.
  serve: (handler: (request: Request) => Response | Promise<Response>) => unknown
  env: {
    // A secret or setting, or undefined when it is not set.
    get: (name: string) => string | undefined
  }
}
