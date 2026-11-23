/**
 * What the admin Forms pages show (D126): the forms an administrator built, one form with its questions,
 * its results by course and lecturer, and its answers. Answers hold nothing that says who sent them.
 */

// The shapes shared with the public page.
import type { FormQuestion, FormQuestionDraft, FormState, LecturerOption } from '@conote/core/forms'

/** How many answers a page of the table holds. */
export const FORM_RESPONSES_PAGE_SIZE = 50

/** One form in the list. */
export interface FormListItem {
  id: string
  // The secret in the public link.
  token: string
  title: string
  accepting: boolean
  opensAt: string | null
  closesAt: string | null
  createdAt: string
  // Open now, opening later, or closed.
  state: FormState
  questionCount: number
  responseCount: number
}

/** One form with everything the builder needs. */
export interface AdminForm {
  id: string
  token: string
  title: string
  description: string
  accepting: boolean
  opensAt: string | null
  closesAt: string | null
  state: FormState
  responseCount: number
  questions: FormQuestion[]
  // The lecturer choices the timetable gives, for the preview.
  lecturers: LecturerOption[]
}

/** A form as the builder holds it before it is saved. A new form has no ID. */
export interface FormDraft {
  id?: string | undefined
  title: string
  description: string
  accepting: boolean
  opensAt: string | null
  closesAt: string | null
  questions: FormQuestionDraft[]
}

/** The results for one course and lecturer: how many answers, and the average of each rating. */
export interface FormResultRow {
  // Null for a form with no "Course and lecturer" question.
  courseCode: string | null
  lecturer: string | null
  responses: number
  // The average rating, by question ID, to two places. A rating nobody gave is left out.
  averages: Record<string, number>
}

/** One answer. */
export interface FormResponseItem {
  id: string
  createdAt: string
  courseCode: string | null
  lecturer: string | null
  // The other answers, by question ID.
  answers: Record<string, string | number>
}

/** What the answers table is narrowed by. */
export interface FormResponseFilter {
  courseCode?: string | undefined
  lecturer?: string | undefined
  // Where the page starts, counted in answers.
  offset?: number | undefined
}

/** One page of answers, newest first, and how many match in all. */
export interface FormResponsePage {
  items: FormResponseItem[]
  total: number
}

/** The console's form service: build forms, and read what people answered. */
export interface AdminFormService {
  /** Every form, newest first, with its state and how many answers it has. */
  listForms(): Promise<FormListItem[]>
  /** One form with its questions; rejects with not_found for an unknown ID. */
  getForm(formId: string): Promise<AdminForm>
  /**
   * Creates a form (no ID) or changes one, with all its questions, and returns its ID. Once a form has
   * answers no question may be removed and an answered question keeps its kind and choices.
   */
  saveForm(draft: FormDraft): Promise<string>
  /** Deletes a form with its questions and answers. */
  deleteForm(formId: string): Promise<void>
  /** The results by course and lecturer. */
  getSummary(formId: string): Promise<FormResultRow[]>
  /** One page of answers, newest first. */
  listResponses(formId: string, filter: FormResponseFilter): Promise<FormResponsePage>
  /** Deletes one answer, for example one that looks like spam. */
  deleteResponse(responseId: string): Promise<void>
}
