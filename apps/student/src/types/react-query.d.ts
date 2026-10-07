/**
 * Tells TanStack Query that every failed query or mutation carries an AppError. The hooks in
 * src/hooks/ make sure of it by converting whatever a service throws (see appQuery.ts).
 */

// The app's error type.
import type { AppError } from '@conote/core/errors'

// Adds to the library's own types instead of replacing them.
declare module '@tanstack/react-query' {
  // The library reads its default error type from this interface.
  interface Register {
    // Pages can read error.kind without a type check.
    defaultError: AppError
  }
}
