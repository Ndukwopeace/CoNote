# CoNote Teacher Portal — Requirements

**Status:** Draft v1 (T1; D74)
**Scope:** Teacher portal only, in `apps/teacher`
**Related:** [`../MILESTONES.md`](../MILESTONES.md) (milestones T1 and T2), [`../REQUIREMENTS.md`](../REQUIREMENTS.md) (student portal and the decisions log), [`../admin/REQUIREMENTS.md`](../admin/REQUIREMENTS.md) (shared tables and the "nothing fake" rule), [`../ENGINEERING_STANDARDS.md`](../ENGINEERING_STANDARDS.md)

The teacher portal is the third app on the shared backend. A teacher reads the AI's draft summary of a class, corrects it, and publishes it. Nothing reaches students any other way. No student or admin screens live here.

Where this document and the student portal's documents disagree about names, types and statuses, the student portal's `docs/REQUIREMENTS.md` wins.

---

## 1. Scope

**In the MVP (D73):** sign-in, My courses, a course's classes with their summary stages, the review queue, and the review screen (read, edit, save, Approve & Publish).

**Parked (Post-MVP):** rejecting a draft and asking for a new one, draft history, notes to students, analytics for teachers, resources, and a teacher notification centre. They are not in the navigation, because a link that goes nowhere is a fake feature.

## 2. Roles and rules

| Rule                                                                                                                                         | Why                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| A teacher sees and changes only the courses where `courses.teacher_id` is their own ID. Another teacher's course answers "not found".        | One course, one teacher. Not-found hides that it exists.    |
| Archived courses and classes are not listed. Opening one by address shows "not found".                                                       | Admin REQUIREMENTS 6.2.                                     |
| Only a teacher publishes. The only publish action in the repository is Approve & Publish on the review screen, and it always asks first.    | The product's safeguard (student REQUIREMENTS section 1).   |
| A published summary is not edited in the MVP. The review screen shows it read-only.                                                          | Students may already have read it. Corrections are Post-MVP. |
| Only a summary in `in_review` can be edited, saved or published. Any other status refuses the change.                                        | The pipeline order is fixed.                                |

**What a teacher sees of the students' notes while reviewing (decision D74, [Default]).** The draft only, plus how many notes it is based on and from how many students. Never the notes themselves.

- Notes are private to their author. The admin portal already reads counts only (admin REQUIREMENTS 6.3), and a teacher who could read raw notes would break the privacy promise on the student landing page.
- The cost: a teacher can't check a claim in the draft against its sources. The review screen says so plainly ("Based on 18 notes from 14 students"), and the teacher fixes what they know to be wrong from their own lesson.
- If the owner decides teachers should read contributing notes, that is a change to RLS and to the review screen, so it needs a new decision first.

## 3. Routes

| Route                              | Page                                 | Milestone |
| ---------------------------------- | ------------------------------------ | --------- |
| `/teacher/login`                   | Sign in                              | T1        |
| `/teacher/forgot-password`         | Request a reset link                 | T1        |
| `/teacher/reset-password`          | Set a new password                   | T1        |
| `/teacher/courses`                 | My courses                           | T1        |
| `/teacher/courses/:courseId`       | Course: its classes and their stages | T2        |
| `/teacher/reviews`                 | Review queue                         | T2        |
| `/teacher/reviews/:summaryId`      | Review summary                       | T2        |

- `/` and `/teacher` lead to My courses.
- **Signed-out visitors** go to `/teacher/login?redirect=…`. The redirect goes through `isSafeRedirect()`.
- **Wrong role:** a signed-in student or admin sees "This portal is for teachers." with a sign-out button.
- **No sign-up route.** Teachers are invited by an admin.
- **Unknown paths** show a not-found page, inside the frame when under `/teacher`.

## 4. Layout and navigation

- **Sidebar:** My courses (T1), then Review queue (T2). Each destination is added by the milestone that builds it.
- **Top bar:** the account menu (name, email, sign out). Phones get a menu button that opens the sidebar as a sheet.
- **Desktop:** persistent sidebar. **Tablet:** icon rail with tooltips. **Phone:** sheet menu.
- No student or admin navigation appears anywhere.

## 5. Sign in

- **Heading:** "CoNote Teacher". **Subtitle:** "Sign in to review class summaries."
- **Fields:** Email, Password (show/hide). **Links:** "Forgot password?".
- **Recovery:** the same flow and wording as the admin portal (D68). Each reset link works once, and a new request replaces the older one.
- **Password rules:** at least 12 characters with a letter and a number. One rule for all staff accounts. The service checks it again.
- **Wrong role:** a student or admin password authenticates but never opens the portal (the guard shows the notice).
- **Inactive accounts:** `inactive`, `suspended` and `pending` accounts are refused after the right password: "This account is not active. Contact your administrator."
- **Demo accounts** (password `password1`): `teacher@conote.example` gets in. `admin@conote.example` and `student@conote.example` are turned away by the guard.

## 6. My courses (T1)

- **Content:** one card per course the teacher teaches: code, title, status badge (Ongoing, Upcoming, Completed), number of classes, and "n waiting for review" when any class's summary is `in_review`.
- **Order:** ongoing first, then upcoming, then completed; by code within each.
- **Counts:** classes exclude archived ones. "Waiting for review" counts summaries in `in_review` only.
- **States:** loading skeleton; empty ("You aren't teaching any courses yet. An administrator assigns courses."); error with Retry; not-found for a course that isn't theirs (T2).

## 7. Course (T2)

A header (code, title, status) and the course's classes, newest first. Each row shows the class number, title, date, how many notes were contributed, and its summary stage in the teacher's words:

| `summary_status` | Teacher sees                                   | Action             |
| ---------------- | ---------------------------------------------- | ------------------ |
| `collecting`     | "Collecting notes"                             | none               |
| `processing`     | "AI is drafting"                               | none               |
| `in_review`      | "Ready for your review"                        | Review             |
| `published`      | "Published {date}"                             | View               |

## 8. Review queue (T2)

Summaries in `in_review` for the teacher's courses, **longest wait first** (`in_review_since`, oldest at the top). Each row: course code, class title, how long it has waited, notes behind it. Empty: "Nothing is waiting for your review."

## 9. Review summary (T2)

- **Header:** back link, course code and title, class title, stage badge, "Based on {n} notes from {m} students" (D74).
- **The draft** has the student summary's four parts (student REQUIREMENTS FR-SUM-2): an overview, key concepts (title and explanation), common areas of confusion (point and clarification), and key topics (name and optional description). Every text field is editable. Parts can be added and removed. Nothing may be left empty: a blank field blocks saving and names the field.
- **Save draft:** keeps the edits, status stays `in_review`. Unsaved edits warn before the teacher leaves the page.
- **Approve & Publish:** asks first ("Publish this summary? Students in {course} will see it."), then publishes the **saved** draft, sets `reviewed_by` and `published_at`, and moves the status to `published`. Unsaved edits are saved first as part of the same action.
- **Conflicts:** if the draft changed since it was opened (another tab), saving or publishing fails with "This draft changed. Reload to see the latest." and nothing is overwritten.
- **Published:** read-only, with "Published {date}". No edit or publish action.
- **Safe text:** draft text is plain text. Anything rendered as HTML goes through `SafeHtml`.

## 10. Service list

Pages reach these only through `useServices()`. Each has a contract test that the demo and the Supabase implementations both pass. The review contract is written so that the student's summary service reads the same statuses (D73).

| Service         | Function                                          | Notes                                                                                           |
| --------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `auth`          | `getSession`, `signIn`, `signOut`, `requestPasswordReset`, `checkResetLink`, `resetPassword`, `onAuthChange` | Same contract as the admin app's.                                                |
| `teaching`      | `listMyCourses()`                                 | T1. The signed-in teacher's courses with class and waiting counts.                              |
| `teaching`      | `getMyCourse(courseId)`                           | T2. Rejects `not_found` for another teacher's course.                                           |
| `review`        | `listReviewQueue()`                               | T2. Oldest wait first.                                                                          |
| `review`        | `getDraft(summaryId)`                             | T2. Draft, status, version, note and student counts. `not_found` unless the teacher's.          |
| `review`        | `saveDraft(summaryId, draft, version)`            | T2. `conflict` when `version` is stale; refuses any status but `in_review`.                     |
| `review`        | `approveAndPublish(summaryId, version)`           | T2. Same checks. The one publish path.                                                          |

In the backend stage, `saveDraft` and `approveAndPublish` run server-side and check that the caller is the course's teacher and the summary is `in_review`. The browser's guard is for the user experience only.

## 11. States and messages

Every data view handles loading, empty, error and not-found (engineering standard 7). Errors use the shared `errorMessage()` wording, adapted for teachers. The raw error is never shown.

| Situation           | Message                                                         |
| ------------------- | --------------------------------------------------------------- |
| Load failed         | "Something went wrong loading this. Try again." with Retry      |
| Not found           | "We couldn't find that." with a link back to My courses         |
| No access           | "You don't have access to this. Ask an administrator if you need it." |
| Stale draft         | "This draft changed. Reload to see the latest."                 |
| Publish succeeded   | "Summary published."                                            |

## 12. Demo data

The teacher demo has its own seed (`apps/teacher/src/services/mock/seed`), as the admin and student demos do. The signed-in teacher is **Sarah Mbarga** (`teacher-1`). Her course **MTH 202 Linear Algebra** matches the admin demo's; the seed adds one more course so the list isn't a single card, and a second teacher's course so the "only your courses" rule is visible in the data. Classes cover every summary stage. Because the apps are separate origins with separate storage, a summary published here does not appear in the student demo: the hand-off is proved by the review contract (T2) and by the real loop (B3).

## 13. Nothing fake

The teacher portal follows admin REQUIREMENTS section 23: no control that does nothing, no number that isn't computed, no navigation to a page that doesn't exist.

## 14. Acceptance scenario (T2)

1. Sarah signs in and sees My courses with "2 waiting for review" on MTH 202.
2. She opens the queue; the class that has waited longest is first.
3. She edits the overview, saves, and reloads: the edit is there.
4. She chooses Approve & Publish and cancels: nothing changes.
5. She chooses it again and confirms: the summary shows "Published", the queue shrinks by one, and the edit buttons are gone.
6. A student signed in to the teacher portal, or an admin, sees the wrong-role notice. A signed-out visitor is sent to sign-in.
