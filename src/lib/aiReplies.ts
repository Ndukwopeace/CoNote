/**
 * The demo AI's suggested prompts and canned replies (FR-AI-1, FR-AI-6). The real backend
 * replaces the replies; the prompts stay.
 */

// The context shape.
import type { AiContext } from '@/types/domain'

/** Three prompts per scope, worded for what the student is looking at. */
const PROMPTS: Record<AiContext['scope'], [string, string, string]> = {
  all: [
    'What should I review from my courses this week?',
    'Which topics come up across my courses?',
    'What questions did I note that are still open?',
  ],
  course: [
    'Summarise the key ideas of this course so far.',
    'Which classes in this course should I revisit?',
    'Make me a short quiz on this course.',
  ],
  class: [
    'Explain the main idea of this class simply.',
    'What did students find confusing in this class?',
    'Give me three practice questions on this class.',
  ],
}

/** The reply to each suggested prompt. */
const REPLIES: Record<string, string> = {
  [key(PROMPTS.all[0])]:
    'Start with the summaries you haven’t opened yet, then the classes where your notes have questions. In the demo data that means Software Requirements and Essay Structure.',
  [key(PROMPTS.all[1])]:
    'Two threads run through your courses: stating things precisely (requirements, thesis statements) and choosing the right structure (process models, essay structure, data structures).',
  [key(PROMPTS.all[2])]:
    'Your notes tagged "Question" include whether "fast" counts as a requirement and whether a topic sentence can be a question. The approved summaries answer both.',
  [key(PROMPTS.course[0])]:
    'The course so far covers why teams need a process, how to write requirements that can be tested, and how to check them with reviews and prototypes.',
  [key(PROMPTS.course[1])]:
    'Revisit the classes whose summaries are published first, then any class where you wrote a note tagged "Question".',
  [key(PROMPTS.course[2])]:
    '1. What makes a requirement testable?\n2. Name one functional and one non-functional requirement.\n3. What is the difference between validation and verification?',
  [key(PROMPTS.class[0])]:
    'In one line: say what the system must do, and how well it must do it, in words you can test.',
  [key(PROMPTS.class[1])]:
    'The approved summary lists the common points of confusion and your teacher’s clarification for each. Open the AI Summary tab to read them.',
  [key(PROMPTS.class[2])]:
    '1. Define the main idea of this class in one sentence.\n2. Give an example from your own notes.\n3. What would change if the idea were ignored?',
}

/** The generic reply for anything else. */
const FALLBACK =
  'This is the demo, so answers are prepared in advance. Try one of the suggested questions. The full version answers from your teacher-approved summaries and your own notes.'

/** A prompt normalised for matching: trimmed, lower case, single spaces. */
function key(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** The three suggested prompts for a context. */
export function suggestedPrompts(context: AiContext): string[] {
  // A copy, so callers can't change the table.
  return [...PROMPTS[context.scope]]
}

/** The demo reply to a question: the prepared answer for a suggested prompt, else the fallback. */
export function cannedReply(question: string): string {
  return REPLIES[key(question)] ?? FALLBACK
}
