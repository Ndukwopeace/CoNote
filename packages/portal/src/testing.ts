/**
 * What the portals' tests share (D77): the AuthService contract suite, and the note reading
 * contract (D123).
 */

export { describeAuthServiceContract } from './auth/authService.contract'
export type { AuthContractSetup } from './auth/authService.contract'
export { runNoteReadingContract } from './notes/noteReading.contract'
export type { NoteReadingFixture } from './notes/noteReading.contract'
