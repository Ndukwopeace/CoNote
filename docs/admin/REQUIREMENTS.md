# CoNote Admin Portal — Requirements

**Status:** Draft v1 (from the admin brief, aligned with the student portal; D64, D66)
**Scope:** Admin portal only, in `apps/admin`
**Related:** [`MILESTONES.md`](./MILESTONES.md) (admin milestones), [`../REQUIREMENTS.md`](../REQUIREMENTS.md) (student portal and the decisions log for the whole repository), [`../ENGINEERING_STANDARDS.md`](../ENGINEERING_STANDARDS.md)

The Admin Portal for CoNote: the admin side only. No student or teacher screens.

It is aligned with the CoNote Student Portal in the same repository (`apps/student`). Where this document and the student portal's documents disagree, the student portal's `docs/REQUIREMENTS.md` wins for shared names, types and statuses. Anything new here that the other portals must also follow is marked **[Shared change]**, and has to be added to the shared schema before the backend is built.

---

## 1. Where the project stands

Read this first. It decides how the build works.

- **Student Portal:** built. React + TypeScript + Vite, deployed on Vercel. It runs on **mock data** today (`VITE_DATA_SOURCE=mock`). Its Supabase layer is a placeholder that refuses to start.
- **Shared backend (Supabase):** **not built yet.** There is no database schema, Row Level Security, storage, AI pipeline or notification system.
- **Teacher Portal:** not built.

So the Admin Portal is built the same way the Student Portal was:

1. **Now:** a complete admin interface on a mock data layer. The mock uses the **same table names, field names, IDs, statuses and seed data** as the student portal's mock, so the two describe one platform.
2. **Backend stage (separate milestone):** the shared Supabase project is built once for all three portals. Each portal then swaps its mock layer for the Supabase layer without page changes.

"No isolated mock data" means this: the mock must mirror the shared schema exactly and must never invent its own shapes. A mock is allowed. A different data model is not.

---

## 2. Architecture

```
Student Portal  ─┐
Teacher Portal  ─┼──►  one Supabase project
Admin Portal    ─┘     (Auth, Postgres + RLS, Storage, Edge Functions)
                              │
                 AI pipeline · notifications · audit triggers
```

- **Separate app, same repository (D64, D66).** The admin portal lives in `apps/admin` of the CoNote monorepo and deploys as its own Vercel project (Root Directory `apps/admin`, for example `admin.<domain>`). The student app never contains admin screens, routes or links. Shared code comes from the packages: `@conote/ui` (design system, primitives, forms, common page parts), `@conote/domain` (roles and statuses), `@conote/core` (errors, safe redirects, environment, reporting) and `@conote/testing` (test helpers).
- **No second database, auth system or storage.** One Supabase project serves all three portals.
- **The browser never holds secrets.** It holds only the Supabase URL and anon key. Anything that needs the service-role key or an AI provider key runs in a Supabase Edge Function that checks the caller is an active admin first.

---

## 3. Roles and responsibilities

Roles are lowercase, as in the shared `profiles.role` column: `student`, `teacher`, `admin`.

| Role | Does | Never does |
|---|---|---|
| `student` | Writes private notes, reads published summaries, uses Ask CoNote AI, gets notifications | Sees drafts, other students' notes, teacher or admin tools |
| `teacher` | Reviews, edits, approves and publishes summaries for the courses they teach | Changes another teacher's course, manages users |
| `admin` | Manages users, courses, classes, enrolment, resources and settings; monitors AI jobs and the summary pipeline; reads analytics and audit logs | Approves or publishes academic summaries; reads students' private notes |

**Teacher approval is mandatory.** The pipeline is fixed:

```
Student notes → AI draft → Teacher review → Teacher approval → Published → Students
```

There is no "Admin approve" button, and no emergency override in v1. If one is ever needed, it gets its own design, needs explicit authorisation and writes an audit entry.

---

## 4. Technology and engineering standards

Use the same stack and versions as the student portal:

- React 19
- TypeScript 6 in strict mode
- Vite 8
- Tailwind CSS 4 with design tokens
- shadcn/ui
- Lucide icons
- React Router 8 (data router, lazy routes)
- TanStack Query 5
- react-hook-form + zod
- Vitest + Testing Library
- Playwright
- ESLint, Prettier

**Charts:** Recharts, with the reason recorded (it's a new dependency).

Follow the repository's `docs/ENGINEERING_STANDARDS.md`, which applies to every app. In short:

- **Testing:** test-driven development, with the failing test written first. Every bug fix starts with a failing test. Logic folders keep at least 80% coverage.
- **Layers:** UI never imports a service implementation. Pages use `useServices()`, and only the service factory touches `services/mock` or `services/supabase`.
- **Code rules:** no `any`, no `console.log`. Errors go through `reportError()`. Every statement is commented; security lines start with `SECURITY:`.
- **Data states:** every data view handles loading, empty, error and not-found.
- **Safety:** any user-written HTML renders only through a sanitising `SafeHtml` component. `?redirect=` values are checked before use.
- **Dependencies:** no new dependency without a stated reason.
- **Workflow:** GitHub Flow, one pull request per milestone. CI runs lint, format, typecheck, tests, build, `npm audit` and secret scanning.

---

## 5. Design

Use the shared CoNote tokens. No hex values in components.

| Token | Value |
|---|---|
| `--primary` | `#4F46E5` |
| `--primary-dark` | `#3730A3` |
| `--primary-light` | `#EEF2FF` |
| `--background` | `#F8FAFC` |
| `--surface` | `#FFFFFF` |
| `--foreground` | `#111827` |
| `--muted-foreground` | `#6B7280` |
| `--success` | `#16A34A` |
| `--warning` | `#F59E0B` |
| `--error` | `#DC2626` |
| `--border` | `#E5E7EB` |

- **Font:** Plus Jakarta Sans, self-hosted.
- **Radius:** 8 px for controls, 12 px for cards.
- **Spacing:** a 4 px grid.
- **Contrast:** `--warning` and `--success` fail contrast for small text on white. Status badges use a light tint with a darker text shade.
- **Accessibility:** WCAG 2.1 AA, full keyboard use, and `prefers-reduced-motion` respected.

The feel should be a calm, data-first management console. Each screen shows the few things that matter, not everything at once.

---

## 6. Shared data model

### 6.1 Tables that already exist in the student portal's design

| Table | Key fields (snake_case in the database) |
|---|---|
| `profiles` | `id`, `role`, `full_name`, `email`, `avatar_url`, `department`, `level`, `phone`, `notification_prefs` |
| `courses` | `id`, `code`, `title`, `description`, `teacher_id`, `status` (`upcoming` / `ongoing` / `completed`), `schedule_text` |
| `enrollments` | `course_id`, `student_id` |
| `class_sessions` | `id`, `course_id`, `number`, `title`, `description`, `starts_at`, `ends_at`, `summary_status` |
| `notes` | `id`, `student_id`, `course_id`, `class_id`, `title`, `content_html`, `tags`, `created_at`, `updated_at` |
| `summaries` | `id`, `class_id`, `course_id`, `overview`, `key_concepts`, `confusion_areas`, `key_topics`, `notes_analyzed_count`, `reviewed_by`, `published_at` |
| `notifications` | `id`, `user_id`, `type`, `title`, `body`, `link`, `created_at`, `read` |

The UI says **"Class"**. The table is `class_sessions`. A course has **one teacher** (`courses.teacher_id`).

### 6.2 New shared tables and columns **[Shared change]**

- `profiles.status`: `active`, `inactive`, `suspended` or `pending` (`pending` means invited, not yet signed in). The backend refuses sign-in for anything but `active`. The student portal needs an "account inactive" screen.
- `courses.archived_at`, `class_sessions.archived_at`: nullable timestamps. Archived items disappear from student and teacher lists but are never deleted.
- `profiles.student_number`, `profiles.staff_number`: the human-readable student and teacher IDs, separate from the internal `id`.
- `resources`: `id`, `title`, `description`, `type` (`pdf` / `document` / `slides` / `video` / `link`), `storage_path` or `url`, `course_id`, `class_id` (nullable), `uploaded_by`, `created_at`, `status` (`draft` / `published` / `archived`).
- `ai_jobs`: `id`, `class_id`, `course_id`, `kind` (`summary` / `regenerate`), `status` (`queued` / `running` / `succeeded` / `failed`), `started_at`, `finished_at`, `error_code`, `error_message` (safe text only), `attempt`.
- `audit_logs`: `id`, `created_at`, `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `course_id`, `class_id`, `metadata` (JSON). Append-only. Written by database triggers and Edge Functions, never by the browser.
- `activity_events`: `id`, `user_id`, `kind` (`sign_in` / `note_created` / `summary_viewed` / `resource_opened` / `ai_question`), `created_at`, plus the related IDs. Analytics read from here. Store no note content.
- `platform_settings`: one row of non-secret settings (see section 17).

Summary status is extended to add one value: `collecting` → `processing` → `in_review` → `published`, plus `failed`.

- **Admin portal labels:**
  - "Ready for review" means `in_review` that no teacher has opened yet.
  - "Under review" means a teacher has opened it.
  - "Failed" comes from the latest AI job.
- **Rejection:** when a teacher rejects a draft and asks for a new one, the summary goes back to `processing`. There are no separate `APPROVED`, `REJECTED` or `UNDER_REVIEW` states, because approval and publishing happen in one teacher action.
- **What students see:** the student portal shows `failed` the same way as `processing`.

The teacher portal may add `summary_versions` and `summary_reviews` for draft history. The admin portal shows them read-only if they exist.

### 6.3 Who may read what (Row Level Security)

- **`notes`:** only their author. Admins never read note content. Admin views show counts only, such as "23 notes from 18 students".
- **`summaries`:**
  - students see `published` rows for courses they're enrolled in
  - teachers see rows for their own courses
  - admins see status and metadata, but not draft text
- **Course management** (`courses`, `class_sessions`, `enrollments`, `resources`): admins have full write access. Teachers can read their own courses. Students can read what they're enrolled in.
- **`audit_logs`, `ai_jobs`, `activity_events`:** admins can read them. Nobody writes to them from a browser.
- **The role check** comes from the `profiles` row, which only admins (through an Edge Function) can change, never from anything the client sends. A student or teacher calling an admin function directly gets a 403.

---

## 7. Routes

| Route | Page |
|---|---|
| `/admin/login` | Sign in |
| `/admin/forgot-password` | Request a reset link |
| `/admin/reset-password` | Set a new password |
| `/admin/dashboard` | Dashboard |
| `/admin/users` | Users, with Students / Teachers / Admins tabs in `?tab=` |
| `/admin/users/:userId` | User details |
| `/admin/courses` | Courses |
| `/admin/courses/:courseId` | Course details (Overview / Students / Classes / Resources tabs) |
| `/admin/classes` | Classes |
| `/admin/classes/:classId` | Class details |
| `/admin/resources` | Resources |
| `/admin/resources/:resourceId` | Resource details |
| `/admin/ai-summaries` | AI & Summaries |
| `/admin/ai-summaries/:summaryId` | Summary pipeline details (status, jobs, timeline; no draft text) |
| `/admin/analytics` | Analytics |
| `/admin/audit-logs` | Audit logs |
| `/admin/settings` | Settings, with sections in `?section=` |
| `/admin/notifications` | Admin notifications |

There is no sign-up route.

- **Signed-out visitors:** every route except the sign-in and password pages sends them to `/admin/login?redirect=…`.
- **Wrong role:** a signed-in student or teacher sees "This portal is for administrators." with a sign-out button.
- **Unknown paths:** they show a not-found page.

---

## 8. Layout and navigation

- **Sidebar:** Dashboard, Users, Courses, Classes, Resources, AI & Summaries, Analytics, Audit Logs, Settings.
- **Top bar:** search, a notifications bell with unread count, and the avatar menu (profile, sign out).
- **Desktop:** a persistent sidebar.
- **Tablet:** a sidebar that collapses to icons.
- **Phone:** a menu button opens the sidebar as a sheet.
- **Tables:**
  - on phones, wide tables become stacked cards with the key fields and an actions menu
  - on tablets, they scroll horizontally with the first column pinned
  - filters live in a sheet on phones

No student or teacher navigation appears anywhere.

---

## 9. Sign in

- **Heading:** "CoNote Admin"
- **Subtitle:** "Sign in to manage the CoNote platform."
- **Fields:** Email and Password (with a show/hide toggle)
- **Links and buttons:** a "Sign In" button and a "Forgot password?" link

**Accounts.**
- There is no public registration.
- Admins are invited by another admin (through an Edge Function) or created from the Supabase dashboard.
- A user who isn't an active admin gets the wrong-role message after signing in. A student or teacher password works for authentication but never opens the portal.

**Password recovery (A2, D68).**
- **Forgot password** (`/admin/forgot-password`): the administrator enters an email and always sees "If an account exists for that email, we sent a link to reset its password.", whether or not the account exists. In demo mode a "Continue to reset (demo)" button stands in for the email.
- **Reset password** (`/admin/reset-password?code=…`): the link is checked first. A missing, made-up, replaced or used link shows "This link has expired" with "Request a new link". A valid link shows New password and Confirm new password.
- **Rules:** at least 12 characters with a letter and a number, longer than the students' 8, because an admin account can change the whole platform. The service checks them again.
- **Links:** each reset link works once, and a new request replaces the older link. The service checks the link again when saving, so a page left open on an old link can't change the password.
- **After saving:** the administrator lands on sign-in with "Your password has been updated. Sign in with your new password." The notice travels as a key, never as text.

---

## 10. Dashboard

The header greets by time of day: "Good morning / afternoon / evening, {first name}". The subtitle is "Here's an overview of your CoNote platform."

**Stat cards** (real counts; the example numbers in the original brief are illustrations only):

- Students
- Teachers
- Active courses (not archived)
- Classes this term
- Published summaries
- AI jobs running or queued

**Activity chart:** one chart with a range picker (7 / 30 / 90 days) and a series picker:
- notes created
- summaries generated
- summaries published
- resources opened
- AI questions

Keep it to one chart on the dashboard; the rest belong on Analytics.

**System health.** One card listing Database, Authentication, AI service, Storage and Notifications. Each shows "Operational", "Degraded", "Unavailable" or "Unknown".
- Values come from a `health` Edge Function. It is never hard-coded.
- In mock mode, the mock health service returns states the tests can change.

**Alerts.** Each alert is computed from real data and links to the screen that fixes it:
- AI jobs that failed in the last 24 hours
- notifications that failed to send
- courses without a teacher
- classes whose course is archived
- summaries waiting in review for more than N days (N set in Settings)
- storage errors
- recent security events

---

## 11. Users

**Tabs:** Students, Teachers, Admins. A search field matches name, email, student number and staff number.

**Filters:** status, department and course. Filters live in the address, so a filtered view can be shared and survives a refresh.

| Tab | Columns |
|---|---|
| Students | Student number, Name, Email, Courses (count), Status, Created, Last active, Actions |
| Teachers | Staff number, Name, Email, Department, Courses (count), Status, Actions |
| Admins | Name, Email, Status, Created, Actions |

**Actions:**
- View, Edit
- Activate, Deactivate, Suspend
- Send password reset link
- Assign to course (teachers only)
- Invite user (all tabs)

Inviting a user means:
- creating a `pending` profile
- sending an invite email through Supabase Auth
- writing an audit entry

All of this happens in one Edge Function.

Deactivating or suspending asks for confirmation. It takes effect at the user's next request: their session is revoked server-side.

**User details:**
- profile fields
- status history
- courses (enrolled, or taught)
- created date
- last activity

Note content is never shown. There is no "view this student's notes" action.

**Sign-up decision needed.** The student portal allows open student sign-up today (email or Google). Pick one of these, and record it in both portals:
- (a) keep open sign-up, and admins only enrol students into courses
- (b) close sign-up, and admins create every student

This prompt assumes (a).

---

## 12. Courses

**List:** code, title, teacher, students, classes, status, and archived or not.

**Actions:**
- Create
- Edit
- Archive / restore
- Assign / change / remove teacher
- Manage enrolment
- View

**Create / edit fields** (validated with zod; the course code must be unique):
- Course code (e.g. `SWE 311`)
- Title
- Description
- Department
- Teacher
- Status

The teacher picker lists only `active` users with role `teacher`.

**Course details tabs:**
- **Overview:** description, teacher, number of students, classes and published summaries, resources, status.
- **Students:** enrolled list with search. Enrol and remove students, with confirmation. Bulk enrolment by CSV of emails or student numbers: preview first, report rows that don't match, apply only the valid ones.
- **Classes:** sessions with summary status.
- **Resources:** resources attached to this course.

Removing a teacher leaves the course unassigned, and that raises the "course without a teacher" alert.

---

## 13. Classes

**List:**
- course
- number
- title
- date and time
- teacher (from the course)
- summary status
- notes contributed (a count, not content)

**Filter:** course, date range and summary status.

**Create / edit fields:**
- Course
- Class title
- Date
- Start time
- End time
- Description

The class number is assigned automatically within the course. The end time must be after the start time.

**Archive:** archiving hides the class from students and teachers. The class keeps its notes and summary.

**Class details:**
- course, title, teacher, date and time
- enrolled students (a count)
- notes contributed (a count)
- the AI job history
- the summary status timeline

---

## 14. Resources

**Fields:**
- Title
- Description
- Type
- File (PDF, document or slides upload) or URL (video or external link)
- Course
- Class (optional)
- Author
- Upload date
- Status

**Actions:**
- Upload
- Edit
- Publish / unpublish
- Archive
- Delete (asks for confirmation, and only drafts can be deleted)
- Assign to a course or class

**Rules:**
- **Storage:** files go to a private `resources` bucket. They are read through short-lived signed URLs, never public URLs.
- **Upload checks:** the type and size limits are checked in the browser and again server-side.
- **Links:** external links must be `https:` and open with `rel="noopener noreferrer"`.

**[Shared change]** The student portal has no Resources screen yet. Published resources need a student-side view before students can see anything an admin uploads.

---

## 15. AI & Summaries (monitoring only)

**Counters:**
- generated today
- collecting
- processing
- ready for review
- under review
- published
- failed

**Summary table:**
- course, class, teacher
- notes contributed (count)
- AI job status
- summary status
- created, last updated
- action: view pipeline

**AI jobs table:**
- job ID, course, class
- kind
- started, finished, duration
- status, attempt
- error (safe message)

**Failed jobs** have their own tab. The empty state reads: "All AI processing jobs are running normally."

**Retry:**
- is available only on `failed` jobs
- calls an Edge Function that queues a new attempt and writes an audit entry
- is limited by the "maximum retries" setting

There is no approve, publish or edit-draft action anywhere in the admin portal.

**[Shared change]** The AI pipeline and `ai_jobs` are part of the backend stage. In mock mode, the mock AI service has jobs in every state, so the screens and tests are complete.

---

## 16. Analytics

Every figure comes from a real table or `activity_events`. There is no invented score such as an "AI quality score" or "teacher quality score".

- **Users:** students, teachers, active users (signed in within 7 or 30 days), new users, inactive accounts.
- **Academic activity:** courses, classes, notes created, summaries generated, teacher reviews, summaries published.
- **AI:** total jobs, succeeded, failed, average processing time, summaries regenerated.
- **Usage:**
  - daily, weekly and monthly active users
  - notes created
  - summaries viewed
  - resources opened
  - AI questions asked

**Missing data source:** if a metric has no source yet, its card says "Not tracked yet" rather than showing 0.
- In the student portal today, only summary views are recorded (`viewedByMe`).
- Sign-ins, resource opens and AI questions need `activity_events` writers in the backend stage.

**Privacy:**
- Analytics are aggregate.
- Per-student activity appears only as "last active" on the user details page.
- Record the data-retention period in the decisions log.

---

## 17. Audit logs

**Columns:**
- time
- user
- role
- action
- entity
- entity ID
- course / class
- details (metadata)

**Filters:**
- user
- role
- action
- entity type
- date range
- course
- class
- text search

Results are paginated server-side.

**Actions recorded** (by triggers or Edge Functions):
- user invited, activated, deactivated or suspended
- role changed
- password reset sent
- course created, edited, archived or restored
- teacher assigned, changed or removed
- student enrolled or removed (including bulk)
- class created, edited or archived
- resource uploaded, published, archived or deleted
- AI job retried
- settings changed
- summary approved or published by a teacher
- summary regenerated

**IP and device:** record IP address and device only if the institution's privacy policy allows it, and say so in the decisions log. The default is off.

Audit logs are read-only in the UI. They can't be edited or deleted.

---

## 18. Notifications (admin)

Admins get notifications in the shared `notifications` table, with type `system` and a severity. Examples:
- AI job failed
- notification delivery failed
- storage error
- course without a teacher
- processing queue above a threshold
- security event

There is a bell in the top bar and a page with All and Unread tabs, plus mark-as-read and mark-all-read.

---

## 19. Settings

| Section | Contents |
|---|---|
| Platform | Platform name, description, default timezone, default language, maintenance mode (shows a banner on all portals and blocks sign-in for non-admins) |
| Authentication | Sign-up mode (open / closed, see section 11), allowed email domains, session length |
| Notifications | Which events alert admins, review-wait threshold (days), queue threshold |
| AI | Provider and model names (display and choice only), maximum retries, summary options, off-topic detection on/off, current AI service status |
| Storage | Upload size and type limits, bucket usage |
| Security | Recent security events, active admin sessions |
| Appearance | Not in v1 (no dark mode yet); show the shared tokens read-only |

**Rules:**
- **Secrets:** API keys are never stored in or shown by the frontend. They live in Supabase secrets.
- **Saving:** every save is validated, confirmed and audited.

---

## 20. Service layer

Same pattern as the student portal:
- a TypeScript interface for each service in `services/contracts`
- a mock implementation and a Supabase implementation behind one factory
- shared contract tests run against both

| Service | Functions |
|---|---|
| `AuthService` | `signIn`, `signOut`, `requestPasswordReset`, `checkResetLink`, `resetPassword`, `getSession`, `onAuthChange` |
| `UserService` | `listUsers(filter)`, `getUser`, `inviteUser`, `updateUser`, `setUserStatus`, `sendPasswordReset` |
| `CourseService` | `listCourses(filter)`, `getCourse`, `createCourse`, `updateCourse`, `archiveCourse`, `restoreCourse`, `assignTeacher`, `removeTeacher`, `listEnrollments`, `enrollStudents`, `removeStudent` |
| `ClassService` | `listClasses(filter)`, `getClass`, `createClass`, `updateClass`, `archiveClass` |
| `ResourceService` | `listResources(filter)`, `getResource`, `createResource`, `uploadFile`, `updateResource`, `setResourceStatus`, `deleteResource` |
| `SummaryMonitorService` | `listSummaries(filter)`, `getSummaryPipeline`, `getSummaryCounts` |
| `AiJobService` | `listJobs(filter)`, `retryJob` |
| `HealthService` | `getHealth` |
| `AnalyticsService` | `getUserStats`, `getAcademicStats`, `getAiStats`, `getUsageStats`, `getActivitySeries(range, series)` |
| `AuditService` | `listAuditLogs(filter)` |
| `NotificationService` | `list`, `unreadCount`, `markRead`, `markAllRead` |
| `SettingsService` | `getSettings`, `updateSettings` |

**Edge Functions** (backend stage): `invite-user`, `set-user-status`, `send-password-reset`, `retry-ai-job`, `health`, `update-settings`. Each one:
1. verifies the caller's JWT
2. loads their profile and checks `role = 'admin'` and `status = 'active'`
3. validates input with zod
4. does the work
5. writes the audit entry

---

## 21. Components

**Layout and data:**
- `AdminSidebar`, `AdminTopBar`
- `StatCard`, `SystemHealthCard`, `ActivityChart`, `AlertList`
- `DataTable` (sorting, pagination, column visibility, card view on phones), `FilterBar`, `SearchBar`
- `UserTable`, `CourseTable`, `ClassTable`, `ResourceTable`, `SummaryTable`, `AiJobTable`, `AuditLogTable`

**Feedback and forms:**
- `StatusBadge` (user status, course status, summary status, job status, resource status)
- `ConfirmDialog`, `FormDialog` (a sheet on phones)
- `EmptyState`, `ErrorState`, `LoadingSkeleton`

**Skeletons:**
- `DashboardSkeleton`, `AnalyticsSkeleton`
- `UserTableSkeleton`, `CourseSkeleton`, `ClassSkeleton`
- `ResourceSkeleton`, `SummarySkeleton`

---

## 22. States and messages

**Empty states:**
- Users: "No users found."
- Courses: "No courses have been created yet."
- Classes: "No classes available."
- Resources: "No resources have been added."
- Failed jobs: "All AI processing jobs are running normally."
- Audit logs: "No activity has been recorded."
- A filter with no results: "Nothing matches these filters." with a "Clear filters" button.

**Error states:**
- Loading failed: "Unable to load {thing}." with a "Try again" button.
- Saving failed: "Unable to {action}. Please check the information and try again."
- Raw database or function errors are never shown. They go to `reportError()`.

**Not-found:** each `:id` page has its own message and a link back to the list.

---

## 23. Nothing fake

Every button does what it says in mock mode, and later against Supabase:
- creating a course creates it
- assigning a teacher changes the course
- enrolling creates an enrolment
- upload stores a file
- retry queues a job
- deactivate changes the status
- the audit log shows recorded entries

Where the backend doesn't exist yet, the mock implements the behaviour faithfully. It records audit entries too, so the screens can be tested end to end.

---

## 24. Milestones

A1 to A11 build the console on demo data; the shared backend stage (B) connects it to Supabase. The task lists and "done when" checks are in [`MILESTONES.md`](./MILESTONES.md).

---

## 25. Acceptance scenario

Each milestone runs the steps it can.

**In mock mode** (admin side), Playwright checks that the admin can:
1. create course `SWE 311 — Software Engineering`
2. invite teacher Dr. Sarah Mbarga
3. assign her to SWE 311
4. create the class "Software Requirements"
5. enrol students
6. see an audit entry for each step

**After stage B, with the teacher portal built:**

1. A student signs in to the student portal and sees SWE 311 and "Software Requirements".
2. The student writes notes, which are stored in `notes`.
3. The AI job runs, and the summary moves to `in_review`.
4. The teacher sees "1 summary requires review", edits the draft, and clicks "Approve & Publish". The summary becomes `published`.
5. The student gets a notification and reads the summary under Notes → Summaries.
6. The admin follows every step in AI & Summaries, without seeing draft text or note content.

**Security checks** (automated, against Supabase):
- a student or teacher calling admin Edge Functions gets 403
- a teacher can't update another teacher's course
- a student can't update a summary
- an admin can't read `notes.content_html`
