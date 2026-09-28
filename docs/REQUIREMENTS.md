# CoNote Student Portal — Requirements

**Status:** Draft v0.2 (adds the gaps found in `USER_FLOWS.md`)
**Scope:** Student Portal only
**Sources:** Original written brief (partial, cut off during Sign Up) and the wireframes in [`docs/wireframes/`](./wireframes)
**Related:** [`MILESTONES.md`](./MILESTONES.md), [`USER_FLOWS.md`](./USER_FLOWS.md) (sitemap, user flows, user journeys), [`ENGINEERING_STANDARDS.md`](./ENGINEERING_STANDARDS.md) (testing, architecture, security, review)

Items marked **[Default]** are working decisions made to unblock the build. They can change later. Section 15 lists every one of them in a single table.

---

## 1. Product summary

CoNote is an academic note-taking platform. Students write private notes for each class they attend. CoNote AI reads the combined notes for a class and produces a draft summary. A teacher corrects and approves the draft. Only then do students see it.

```
Student notes (private) → CoNote AI → Draft summary → Teacher review → Teacher approval → Published summary → Students
```

Rules that shape every screen:

- A student can read and change **only their own notes**.
- There is no student-to-student chat or messaging.
- A student never sees a summary that a teacher has not approved.
- The student portal never shows teacher or admin tools.

---

## 2. Scope

### 2.1 In scope

- Public landing page
- Authentication: sign in, sign up, forgot password, reset password
- Student portal: Dashboard, Courses, Course Details, Class, Notes (list, create, view, edit, delete), Summary view, Ask CoNote AI, Notifications, Settings (with Profile)
- Responsive layouts for desktop, tablet and phone
- A data-access layer that runs on mock data now and on Supabase later without page changes

### 2.2 Out of scope

- Teacher portal, including summary review and approval
- Admin portal, including user management, course creation and class creation
- The AI pipeline that builds draft summaries
- A live language model behind Ask CoNote AI. v1 uses canned replies. See FR-AI.
- Student-to-student messaging of any kind
- Payments and pricing
- Native mobile apps
- Dark mode. Tokens must make it possible later, but v1 does not ship it.

The teacher/admin wireframe (`teacher-admin-reference.jpg`) is kept for reference only. It shows the summary lifecycle and the summary structure, and the student-side data types must match both.

---

## 3. Users

| Role | In this app? | Notes |
|---|---|---|
| Student | Yes | The only role that can use the portal |
| Teacher | No | Uses a separate portal on the same backend |
| Admin | No | Uses a separate portal on the same backend |

A signed-in user whose role is not `student` sees this message: "This portal is for students. Please use the teacher or admin portal." A sign-out button sits under it. No teacher or admin links appear anywhere.

---

## 4. Summary lifecycle (student view)

There is one summary per class session. The backend moves it through these states. The student portal reads the state and never changes it.

| State | Set by | What the student sees on the Class page |
|---|---|---|
| `collecting` | System | "Summary not available yet. Add your notes to contribute." |
| `processing` | AI pipeline | "CoNote AI is analysing class notes." |
| `in_review` | AI pipeline | "Your teacher is reviewing the summary." |
| `published` | Teacher | The full summary |

**[Default]** Students can see that a summary exists and what stage it is at. They cannot see draft content.

---

## 5. Technology

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript (strict mode) |
| Build | Vite |
| Styling | Tailwind CSS with design tokens as CSS variables |
| Components | shadcn/ui (Radix primitives) |
| Icons | Lucide |
| Routing | React Router v6 (data routers) |
| Server state | TanStack Query |
| Client state | React context for the auth session. Local component state for everything else. No global store unless a real need appears. |
| Forms | react-hook-form + zod (the shadcn Form pattern) |
| Rich text | Tiptap. Content stored as HTML and sanitised with DOMPurify before display. **[Default]** |
| Hosting | Vercel, from the end of M1. A `vercel.json` rewrite sends every path to `index.html` so client-side routes survive a refresh. |
| Backend (later) | Supabase: Auth, Postgres with Row Level Security, Edge Functions |
| Tests | Vitest + Testing Library |
| Quality | ESLint, Prettier, `tsc --noEmit` |
| CI | GitHub Actions: lint, format check, typecheck, tests and build on every pull request and push to the default branch. See `MILESTONES.md`. |

### 5.1 Folder structure

```
src/
  app/            router, providers, query client
  pages/          one folder per route (landing, auth, dashboard, courses, ...)
  layouts/        PublicLayout, AuthLayout, PortalLayout
  components/
    ui/           shadcn primitives (generated)
    common/       shared app components (StatCard, EmptyState, StatusBadge, PageHeader)
    <feature>/    feature components (notes/, courses/, summary/, ai/, ...)
  features/auth/  AuthProvider, useAuth, RequireStudent route guard
  hooks/          TanStack Query hooks (useCourses, useNotes, useSummary, ...)
  services/       service interfaces + implementations
    mock/         in-memory/localStorage implementation and seed data
    supabase/     Supabase implementation (stubbed in v1)
  types/          domain types (section 12)
  lib/            utils, date formatting, sanitising, constants
  styles/         tokens.css, globals.css
```

### 5.2 Data source switch

- `VITE_DATA_SOURCE=mock | supabase`, defaulting to `mock`.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are read only when the source is `supabase`.
- Pages and hooks import service **interfaces**, never an implementation. One factory picks the implementation at startup.
- Mock data persists to `localStorage`, so notes a user creates survive a reload. A "Reset demo data" action in Settings → Help clears it.

---

## 6. Design system

### 6.1 Colour tokens

All colours come from tokens. No hex values appear in components.

| Token | Value | Use |
|---|---|---|
| `--primary` | `#4F46E5` | Buttons, active nav, links, focus ring |
| `--primary-dark` | `#3730A3` | Hover and pressed primary |
| `--primary-light` | `#EEF2FF` | Active nav background, selected tabs, info banners |
| `--background` | `#F8FAFC` | Page background |
| `--surface` | `#FFFFFF` | Cards, sidebar, header, inputs |
| `--foreground` | `#111827` | Main text |
| `--muted-foreground` | `#6B7280` | Secondary text |
| `--success` | `#16A34A` | Published, Live, success toasts |
| `--warning` | `#F59E0B` | Upcoming, pending review |
| `--error` | `#DC2626` | Errors, destructive actions, unread badge |
| `--border` | `#E5E7EB` | Borders and dividers. **Added:** the brief gave no border colour. |

**Added: course accent palette.** The wireframes tint each course icon (purple, green, orange, blue). To keep this inside the token system, define four fixed accents (`--accent-1` … `--accent-4`), each with a matching light tint. A course gets one by a stable hash of its ID.

**Contrast rules.** `--warning` on white is about 2.1:1 and `--success` on white is about 3.3:1. Both fail WCAG AA for small text. For status badges, use a light tint background with a darker text shade (for example a green-50 background with green-800 text). Do not put small text in the raw colour.

### 6.2 Typography

- **[Default]** Font: Plus Jakarta Sans from Google Fonts, falling back to `system-ui`. It matches the geometric look of the wireframes.
- Scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 px. Body text is 14–16 px.

### 6.3 Shape and spacing

- Radius: 8 px for inputs and buttons, 12 px for cards, 16 px for hero panels.
- Spacing on a 4 px grid.
- Shadows stay light. Cards mostly rely on the border.

### 6.4 Shared components

`StatCard`, `StatusBadge` (Live, Upcoming, Ongoing, Completed, Published, In review), `CourseIcon`, `EmptyState`, `PageHeader`, `PrivacyBanner`, `NoteCard`, `SummarySection`, `ChatMessage`, `SuggestedPrompt`, `LoadingSkeleton` variants, `ConfirmDialog`.

---

## 7. Routes

### 7.1 Public

| Path | Page |
|---|---|
| `/` | Landing |
| `/login` | Sign in |
| `/signup` | Sign up |
| `/forgot-password` | Request a reset link |
| `/reset-password` | Set a new password (target of the email link) |
| `/terms`, `/privacy` | Placeholder legal pages. The signup checkbox links here. |

A signed-in student who visits `/`, `/login` or `/signup` is redirected to `/dashboard`.

### 7.2 Portal (requires a signed-in student)

| Path | Page |
|---|---|
| `/dashboard` | Dashboard |
| `/courses` | My Courses |
| `/courses/:courseId` | Course Details (tab via `?tab=overview\|classes\|notes\|summaries`) |
| `/courses/:courseId/classes/:classId` | Class (tab via `?tab=overview\|notes\|summary`) |
| `/courses/:courseId/classes/:classId/summary` | Summary view |
| `/classes` | All classes: Today, Upcoming, Past. Opened from the Dashboard "View all" link. Not in the nav. |
| `/notes` | Notes (tab via `?tab=notes\|summaries`) |
| `/notes/new?classId=` | New note |
| `/notes/:noteId` | Read note |
| `/notes/:noteId/edit` | Edit note |
| `/ask-ai` | Ask CoNote AI (optional `?courseId=` / `?classId=` context) |
| `/notifications` | Notifications |
| `/settings/:tab?` | Settings: `profile` (default), `account`, `notifications`, `privacy`, `help` |
| `/profile` | Redirects to `/settings/profile` |
| `*` | 404 page with a link to the dashboard |

A visitor who is not signed in and opens a portal route goes to `/login?redirect=<path>`. After signing in they return to that path.

---

## 8. Navigation and layout

**[Default]** Primary navigation:

| Item | Icon (Lucide) | Route |
|---|---|---|
| Dashboard | `LayoutDashboard` | `/dashboard` |
| Courses | `BookOpen` | `/courses` |
| Notes | `NotebookPen` | `/notes` |
| Ask AI | `Sparkles` | `/ask-ai` |
| Notifications | `Bell` (unread count badge) | `/notifications` |
| Settings | `Settings` | `/settings` |

Classes are reached through a course, so they get no top-level item.

**Desktop (≥ 1024 px):** a fixed left sidebar, 240 px wide, with the logo at the top and the student's name and avatar at the bottom.
**Tablet (768–1023 px):** the sidebar collapses to an icon rail with tooltips.
**Phone (< 768 px):** a bottom tab bar with Dashboard, Courses, Notes, Ask AI and Notifications. Settings moves to the avatar menu.

**Top bar on every portal page:** global search, a notification bell with the unread count, and an avatar menu (Profile, Settings, Sign out).

**Global search** — **[Default]** v1 matches course code and title, class title and note title. It does not search inside note text. Results are grouped by type in a dropdown. Full-text search of note bodies is planned for the backend stage (see `MILESTONES.md`), where Postgres full-text search is available.

---

## 9. Functional requirements — public pages

### FR-LND Landing page

- **FR-LND-1** Header: CoNote logo; links Features, How It Works, About (anchor scrolls); buttons Sign In (`/login`) and Get Started (`/signup`). On phones the links fold into a menu sheet.
  - **[Default]** The wireframe's "Pricing" link is replaced by "About", as the brief specifies. No pricing content exists.
- **FR-LND-2** Hero: heading "Your notes. Collective understanding."; the subtitle from the brief; Get Started and Sign In buttons; a static preview of the Student Dashboard (desktop and phone frames) built from real components or a screenshot.
- **FR-LND-3** How CoNote Works has six steps, with the text taken from the brief:
  1. Choose Your Course
  2. Open Your Class
  3. Write Your Personal Notes
  4. CoNote AI Analyzes
  5. Teacher Reviews
  6. Students Learn

  **[Default]** Six steps, not the wireframe's five. The teacher step is the product's main safeguard.
- **FR-LND-4** Features grid with four cards: Personal Notes, Course Organization, AI-Powered Summaries, Ask CoNote AI.
- **FR-LND-5** About section: two or three short paragraphs covering note privacy and teacher approval.
- **FR-LND-6** Call-to-action band ("Start learning smarter with CoNote" + "Create Free Account") and a footer with the logo, tagline, Terms, Privacy and copyright.

### FR-AUTH Authentication

- **FR-AUTH-1 Sign in** (`/login`): email, password (show/hide toggle), "Remember me", "Forgot password?" link, Sign In button, "or continue with" Google and Microsoft buttons, and the line "Don't have an account? Sign up".
- **FR-AUTH-2 Sign up** (`/signup`): full name, email, password, confirm password, a checkbox "I agree to the Terms of Service and Privacy Policy" (required), Sign Up button, Google and Microsoft buttons, and the line "Already have an account? Sign in". New accounts get the `student` role.
- **FR-AUTH-3 Validation:** email format; password at least 8 characters with a letter and a number; confirm must match; full name 2–80 characters. Errors show inline under each field on blur and on submit.
- **FR-AUTH-4 Forgot password:** an email field. The page always shows "If an account exists for that email, we sent a reset link", so it never reveals whether an account exists.
- **FR-AUTH-5 Reset password:** new password and confirm. On success, go to `/login` with a success toast.
  - If the link is expired or already used, show "This reset link has expired" and a button back to `/forgot-password` to request a new one. The password fields are not shown.
- **FR-AUTH-6** Buttons show a loading state and are disabled while a request is in flight. Server errors appear in an alert above the form.
- **FR-AUTH-7 Mock mode:** any valid email and password signs in as the demo student. Google and Microsoft sign in as the demo student straight away.
  - Mock mode sends no email. After a reset request, the confirmation screen also shows a "Continue to reset (demo)" link to `/reset-password`. The link appears only in mock mode.
- **FR-AUTH-8 Supabase mode:** email/password auth plus the `google` and `azure` OAuth providers. "Remember me" off means the session is kept in `sessionStorage`.

---

## 10. Functional requirements — portal

### FR-DSH Dashboard

- **FR-DSH-1** A greeting that follows the local time ("Good morning/afternoon/evening, {firstName}") with the subtitle "Here's what's happening with your learning."
- **FR-DSH-2** Four stat cards, each linking to its list:
  - My Courses (enrolled count)
  - Classes Today
  - New Summaries (published summaries the student has not opened yet)
  - Notes Created (all time)
- **FR-DSH-3** Upcoming Classes: the next 3 sessions, each with a course icon, course code and title, class title, date and time, and a Live or Upcoming badge. Clicking a session opens the Class page. "View all" opens `/classes`.
- **FR-DSH-4** Recent Activity: the last 5 events (summary published, note added, announcement) with relative times.
- **FR-DSH-5** An "Ask CoNote AI" card linking to `/ask-ai`.
- **FR-DSH-6** When the student has no courses, the page shows an empty state: "You're not enrolled in any courses yet. Your teacher or administrator will add you." **[Default]** Students cannot join courses themselves.

### FR-CRS Courses

- **FR-CRS-1** My Courses lists enrolled courses. Each card shows the course icon, code, title, teacher name, student count and a status badge (Ongoing, Upcoming or Completed), with a chevron to open it.
- **FR-CRS-2** Search by code, title or teacher. Filter by status (All, Ongoing, Upcoming, Completed). Both are kept in the URL query string.
- **FR-CRS-3 Course Details header:** back link, teacher avatar and name, code and title, number of students, number of classes, status badge.
- **FR-CRS-4 Course Details tabs:**
  - *Overview:* description, teacher, schedule text
  - *Classes:* a numbered list of sessions in date order with date, time, status, the student's note count and a "Summary available" marker
  - *Notes:* the student's own notes for this course
  - *Summaries:* published summaries for this course's classes

### FR-CLS Class

- **FR-CLS-1 Header:** back link to the course, course code and title, class number and title, date and time, status badge.
- **FR-CLS-2 Tabs:**
  - *Overview:* description and a card showing the summary state (section 4)
  - *Notes:* the student's notes for this class plus an "Add Note" button
  - *Summary:* the full summary if published, otherwise the state card
- **FR-CLS-3** The Notes tab always shows the privacy banner: "Your notes are private. You can only see your own notes."
- **FR-CLS-4** Empty state when there are no notes: "No notes yet. Start taking notes for this class. Your notes will be private and used to help generate summaries."
- **FR-CLS-5** Previous and Next class links at the bottom. Each is hidden at the ends of the list.
- **FR-CLS-6** `/classes` lists every session across enrolled courses, grouped into Today, Upcoming and Past.

### FR-NTE Notes

- **FR-NTE-1 Create and edit form:**
  - title (optional; if blank, the first line of the body is used, or "Untitled note")
  - class (preselected when opened from a class, otherwise picked from course → class)
  - rich-text body
  - tags
  - Cancel and Save Note buttons
- **FR-NTE-2 Editor toolbar:** bold, italic, underline, heading, bullet list, numbered list, link, undo, redo.
- **FR-NTE-3 Tags:** presets "Key concept", "Question", "Example" and "Aha moment", plus custom tags (up to 10 tags, up to 30 characters each).
- **FR-NTE-4** The body is required (at least 1 character of text). Maximum 20,000 characters.
- **FR-NTE-5** Cancel with unsaved changes asks for confirmation. **[Default]** Unsaved drafts are also kept in `localStorage` per class, so an accidental reload loses nothing.
  - **Restoring a draft:** when the editor opens and a saved draft exists for that class (or for that note, when editing), a banner above the editor reads "You have an unsaved draft from {relative time}" with **Restore** and **Discard** buttons. Restore loads the draft into the form; Discard deletes it and keeps the form as it was.
  - A draft is deleted after a successful save, or when the student discards changes on Cancel.
  - Drafts older than 7 days are deleted without prompting.
- **FR-NTE-6** Save shows a toast and returns to the Class page on the Notes tab.
- **FR-NTE-7 Notes page:**
  - tabs My Notes and Summaries
  - filter by course, text search and a newest/oldest sort
  - each row shows the course icon, title, course code and class, date and tags, with an edit icon and a menu (Open, Edit, Delete)
- **FR-NTE-8** Delete asks for confirmation and is final.
- **FR-NTE-9** **[Default]** Notes can be edited or deleted at any time. Changes made after the AI has processed a class do not alter an already-published summary. The page says so when a student edits a note on a class with a published summary.
- **FR-NTE-10 Read view** (`/notes/:noteId`): sanitised HTML, tags, class link and timestamps.

### FR-SUM Summary view

- **FR-SUM-1 Header:** back link, course code and title, class title, a "Published" badge, the published date, "Reviewed by {teacher}", and "Based on {n} student notes".
- **FR-SUM-2 Tabs:**
  - *AI Summary:* an overview paragraph; **Key Concepts** (each with a title and explanation); **Common Areas of Confusion** (each with the point of confusion and the teacher-approved clarification)
  - *Key Topics:* a list or chip grid of topics, each with a one-line description
- **FR-SUM-3** A label near the top: "AI-generated from class notes, reviewed and approved by your teacher."
- **FR-SUM-4 Ask CoNote AI panel:**
  - on desktop, a side panel scoped to this summary, with 3 suggested questions and a text input
  - on phones, a floating button that opens the same panel as a bottom sheet
- **FR-SUM-5** Opening a summary marks it as viewed, which updates the dashboard's "New Summaries" count.
- **FR-SUM-6** If the summary is not published, the route shows the state card, never draft content.

### FR-AI Ask CoNote AI

- **FR-AI-1** A chat page with a message list, suggested prompts on an empty conversation, and an input. Enter sends; Shift+Enter adds a new line.
- **FR-AI-2** A context picker: All my courses, a course, or a class. It is preset from the query string when the page is opened from a course, class or summary.
  - Changing the context starts a new conversation, so one conversation never mixes material from two contexts. If the current conversation has messages, the student confirms first: "Changing the context starts a new conversation."
- **FR-AI-3** **[Default]** Intended grounding: the AI answers from teacher-approved summaries and the student's own notes in the chosen context. It never reads other students' notes directly.
- **FR-AI-4** A disclaimer under the input: "Answers are based on approved summaries and your notes. Check important details with your teacher."
- **FR-AI-5** A typing indicator while waiting. Errors show inline with a Retry button.
- **FR-AI-6 v1 behaviour (mock):** the reply is canned text keyed to the suggested prompts, with a generic fallback, after a delay of 600–1200 ms. The conversation lasts for the page session only.
- **FR-AI-7** The service interface (`askAi(context, messages)`) must fit a later streaming backend (a Supabase Edge Function calling a language model) without UI changes.
- **FR-AI-8** Out of scope for v1: saved conversation history, file uploads, voice.

### FR-NTF Notifications

- **FR-NTF-1** Tabs: All, Summaries, System, Messages.
- **FR-NTF-2** Each item shows an icon by type, title, body, relative time and an unread dot.
- **FR-NTF-3** Clicking an item marks it read and opens its link. "Mark all as read" appears in the page header.
- **FR-NTF-4** **[Default]** Messages are one-way announcements from teachers or admins. Students cannot reply, and there are no student-to-student messages.
- **FR-NTF-5** The unread count in the sidebar and bell updates as items are read.
- **FR-NTF-6** v1 fetches on page load and on window focus. Realtime push (Supabase Realtime) comes later.

### FR-SET Settings and Profile

- **FR-SET-1 Profile:** avatar (upload and preview, JPG or PNG, max 2 MB), full name, email (read-only; changed under Account), department, level/year, phone. Save Changes shows a toast.
- **FR-SET-2 Account:** change password (current, new, confirm), connected sign-in providers (Google, Microsoft), sign out, and "Request account deletion" (confirm dialog; mock shows a toast).
- **FR-SET-3 Notifications:** in-app and email toggles for "New summary published", "Class reminders" and "Announcements".
- **FR-SET-4 Privacy:** a plain-language explanation of who can see what (section 1 rules). **[Default]** "Download my notes" exports JSON.
- **FR-SET-5 Help & Support:** an FAQ accordion (at least 5 questions), a contact email, the app version, and "Reset demo data" in mock mode only.

---

## 11. Cross-cutting states

Every data-driven view must have:

- **Loading:** skeletons shaped like the content, not spinners, for lists and cards
- **Empty:** an icon, one sentence and, where it makes sense, one action
- **Error:** a short message and a Retry button, plus a route-level error boundary for unexpected failures
- **Not found:** a missing course, class, note or summary ID shows an in-layout "not found" panel with a back link

Mutations (save note, delete note, mark as read, update profile) use optimistic updates where safe and roll back with an error toast on failure.

---

## 12. Data model

These are TypeScript domain types. Supabase column names are the snake_case forms of the same fields.

```ts
type ID = string;

interface StudentProfile {
  id: ID; role: 'student' | 'teacher' | 'admin';
  fullName: string; email: string; avatarUrl?: string;
  department?: string; level?: string; phone?: string;
  notificationPrefs: NotificationPrefs;
}

interface Teacher { id: ID; fullName: string; avatarUrl?: string; }

interface Course {
  id: ID; code: string; title: string; description: string;
  teacher: Teacher; studentCount: number; classCount: number;
  status: 'upcoming' | 'ongoing' | 'completed'; scheduleText?: string;
}

interface ClassSession {
  id: ID; courseId: ID; number: number; title: string; description?: string;
  startsAt: string; endsAt: string;              // ISO 8601
  // live/upcoming/completed is computed from startsAt/endsAt, not stored
  summaryStatus: 'collecting' | 'processing' | 'in_review' | 'published';
}

interface Note {
  id: ID; studentId: ID; courseId: ID; classId: ID;
  title?: string; contentHtml: string; tags: string[];
  createdAt: string; updatedAt: string;
}

interface Summary {                               // students only ever receive published ones
  id: ID; classId: ID; courseId: ID;
  overview: string;
  keyConcepts: { id: ID; title: string; explanation: string }[];
  confusionAreas: { id: ID; issue: string; clarification: string }[];
  keyTopics: { id: ID; name: string; description?: string }[];
  notesAnalyzedCount: number;
  reviewedBy: Teacher; publishedAt: string;
  viewedByMe: boolean;
}

interface AppNotification {
  id: ID; type: 'summary' | 'system' | 'message' | 'note';
  title: string; body: string; link?: string;
  createdAt: string; read: boolean;
}

interface AiContext { scope: 'all' | 'course' | 'class'; courseId?: ID; classId?: ID; }
interface AiMessage { id: ID; role: 'user' | 'assistant'; content: string; createdAt: string; }
```

### 12.1 Service interfaces

```ts
AuthService         signIn, signUp, signInWithProvider, signOut, requestPasswordReset,
                    updatePassword, getSession, onAuthChange
ProfileService      getMe, updateMe, uploadAvatar
CourseService       listMyCourses, getCourse
ClassService        listClasses(courseId), listMyClasses(range), getClass
NoteService         listMyNotes(filter), getNote, createNote, updateNote, deleteNote, exportMyNotes
SummaryService      listPublished(filter), getByClass(classId), markViewed
NotificationService list, markRead, markAllRead, unreadCount
AiService           askAi(context, messages) → AsyncIterable<string> | Promise<string>
SearchService       search(query)
```

### 12.2 Supabase notes (for the later integration)

- Tables: `profiles`, `courses`, `enrollments`, `class_sessions`, `notes`, `summaries`, `notifications`.
- **RLS on `notes`:** a row is readable and writable only when `student_id = auth.uid()`. The AI pipeline reads notes with the service role on the server, never through the student's client.
- **RLS on `summaries`:** a student can select a row only when `status = 'published'` and they are enrolled in the course. Draft text must never reach a student's client, not even hidden in the UI.
- **RLS on `courses` and `class_sessions`:** readable only by enrolled students.
- The teacher and admin portals share these tables. The student portal needs no write access beyond its own `notes`, `profiles`, notification read-state and summary view-state.

---

## 13. Seed data (mock mode)

Taken from the wireframes:

- **Student:** Victory, Computer Science
- **Courses:**
  - SWE 311 Software Engineering (Dr. Smith, 48 students)
  - ENG 201 Academic Writing
  - CSE 205 Data Structures & Algorithms II
  - BUS 207 Entrepreneurship & Innovation
- **SWE 311 classes:**
  1. Introduction to Software Engineering
  2. Software Requirements
  3. Requirement Validation
  4. SDLC Models

  Session dates are generated relative to today, so there are always live, upcoming and past sessions.
- **Summaries:** at least two published (for example Software Requirements: functional vs non-functional requirements, requirement validation), one `in_review`, one `processing`.
- **Notes:** 10–12 across courses, using every preset tag.
- **Notifications:** 8 across all four types, with some unread.

---

## 14. Non-functional requirements

- **NFR-1 Responsive:** works from 360 px to 1920 px wide with no horizontal page scroll. Touch targets are at least 44 px on phones.
- **NFR-2 Accessibility:** WCAG 2.1 AA.
  - Full keyboard use and visible focus rings.
  - Labelled form fields and alt text on images.
  - Chat replies and toasts announced through `aria-live`.
  - Respect `prefers-reduced-motion`.
- **NFR-3 Performance:** routes are code-split; the landing page has LCP under 2.5 s on a mid-range phone over 4G; the initial JS bundle stays under 250 KB gzipped.
- **NFR-4 Security and privacy:**
  - All user HTML is sanitised before rendering.
  - No secrets in the client beyond the Supabase anon key.
  - Route guards are for UX only; real enforcement is RLS.
  - Nothing in the student bundle references teacher or admin routes.
  - Signing out clears the session, the TanStack Query cache, unsent note drafts and the Ask AI conversation. The next person on a shared computer sees none of the previous student's data, even with the Back button. Mock demo data (notes the student saved) stays, since it stands in for a server.
- **NFR-5 Code quality:** as defined in `ENGINEERING_STANDARDS.md` sections 3 and 4. In short: TypeScript strict with extra flags, zero ESLint errors, no `any`, enforced import boundaries, components under about 250 lines.
- **NFR-6 Testing:** test-driven development as defined in `ENGINEERING_STANDARDS.md` section 2. It covers unit, component, contract and end-to-end tests, with an 80% coverage floor on logic folders.
- **NFR-7 Browsers:** the latest two versions of Chrome, Edge, Firefox and Safari (desktop and iOS).

---

## 15. Decisions log

| # | Decision | Source of conflict | Default chosen |
|---|---|---|---|
| D1 | Ask CoNote AI | Wireframes only | Build the full UI with canned replies. Real model later. |
| D2 | AI grounding | Not specified | Approved summaries plus the student's own notes |
| D3 | Social sign-in | Brief: Google. Wireframe: Google and Microsoft | Google and Microsoft |
| D4 | Landing nav | Brief: About. Wireframe: Pricing | About |
| D5 | How-it-works steps | Brief: 6. Wireframe: 5 | 6, with the teacher review step kept |
| D6 | Sidebar items | Brief and wireframes differ | Dashboard, Courses, Notes, Ask AI, Notifications, Settings |
| D7 | Profile vs Settings | Brief: separate. Wireframe: merged | Merged; `/profile` redirects |
| D8 | Sign-up fields | Wireframe adds confirm password and terms | Include both |
| D9 | Course enrollment | Not specified | Done by teacher or admin; no join UI |
| D10 | Editing notes after processing | Not specified | Allowed; published summaries are unaffected |
| D11 | Messages tab | Not specified | One-way announcements only |
| D12 | Draft summary visibility | Not specified | Status visible, content hidden |
| D13 | Data source | Not specified | Mock data behind service interfaces |
| D14 | Border colour and course accents | Not in the brief | Added as tokens (section 6.1) |
| D15 | Font | Not specified | Plus Jakarta Sans |
| D16 | Rich-text engine | Not specified | Tiptap, HTML storage, DOMPurify |
| D17 | Changing Ask AI context | Found in user flows | Starts a new conversation, after a confirm if messages exist |
| D18 | Search depth | Found in user journeys | Titles only in v1; full-text search in the backend stage |
| D19 | Draft lifetime | Found in user flows | Restore/discard banner; drafts expire after 7 days |

---

## 16. Build milestones

The full task lists and completion checks are in [`MILESTONES.md`](./MILESTONES.md).

| # | Milestone | Done when |
|---|---|---|
| M1 | Project setup | Vite + TS + Tailwind + shadcn set up; tokens in place; router with all routes stubbed; layouts responsive; mock auth and guard working |
| M2 | Public pages | Landing, sign in, sign up, forgot and reset password complete with validation |
| M3 | Courses and classes | Dashboard, Courses, Course Details, Class and `/classes` render from mock services, with loading, empty and error states |
| M4 | Notes | Create, read, edit and delete with the editor, tags, drafts, filters and search |
| M5 | Summaries, AI, notifications, settings | Summary view, Ask AI (mock), Notifications, all Settings tabs |
| M6 | Finishing | Accessibility pass, responsive pass at 360/768/1024/1440, tests green, lint and typecheck clean, README with setup steps |

---

## 17. Open questions

1. Should Ask CoNote AI use general knowledge as well as class material? This changes the backend design (D2).
2. Is there a deadline after which a class's notes stop feeding the AI? It may deserve a "Notes close in 2 days" hint on the Class page.
3. Should students see *how many* classmates contributed notes before a summary is published?
4. Which institutions or email domains may sign up? Is sign-up open to anyone?
5. Is there a real dashboard preview image for the landing page, or should one be built from components?
6. Will she provide a logo file, or should a text-and-icon logo be made from Lucide?
