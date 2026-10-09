# CoNote Student Portal — Requirements

**Status:** Draft v0.3 (adds the installable app, M2.5)
**Scope:** Student Portal only
**Sources:** Original written brief (partial, cut off during Sign Up) and the wireframes in [`docs/wireframes/`](./wireframes)
**Related:** [`MILESTONES.md`](./MILESTONES.md), [`USER_FLOWS.md`](./USER_FLOWS.md) (sitemap, user flows, user journeys), [`ENGINEERING_STANDARDS.md`](./ENGINEERING_STANDARDS.md) (testing, architecture, security, review)

**Where the code is:** the student portal lives in `apps/student/` of the CoNote monorepo (D64). Paths in this document, such as `src/lib/splash.ts`, are relative to that folder. The decisions log (section 15) covers the whole repository.

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
- An installable progressive web app (PWA): add to home screen, app shell available offline, update prompt (FR-PWA, milestone M2.5)
- Offline reading of notes and summaries the student has already opened (FR-PWA-8, with M4 and M5)
- A data-access layer that runs on mock data now and on Supabase later without page changes

### 2.2 Out of scope

- Teacher portal, including summary review and approval
- Admin portal, including user management, course creation and class creation
- The AI pipeline that builds draft summaries
- A live language model behind Ask CoNote AI. v1 uses canned replies. See FR-AI.
- Student-to-student messaging of any kind
- Payments and pricing
- Native mobile apps. The installable PWA covers the home-screen use case.
- Offline writing with background sync, and push notifications. These need the real backend and belong to the backend stage (see `MILESTONES.md`).
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
| Framework | React 19 + TypeScript 6 (strict mode) |
| Build | Vite 8 |
| Styling | Tailwind CSS with design tokens as CSS variables |
| Components | shadcn/ui (Radix primitives) |
| Icons | Lucide |
| Routing | React Router 8 (data router, `createBrowserRouter`, lazy routes) |
| Server state | TanStack Query |
| Client state | React context for the auth session. Local component state for everything else. No global store unless a real need appears. |
| Forms | react-hook-form + zod (the shadcn Form pattern) |
| Rich text | Tiptap. Content stored as HTML and sanitised with DOMPurify before display. **[Default]** |
| PWA | `vite-plugin-pwa` (Workbox) generating the service worker and manifest, from M2.5 |
| Hosting | Vercel, from the end of M1. A `vercel.json` rewrite sends every path to `index.html` so client-side routes survive a refresh. |
| Backend (later) | Supabase: Auth, Postgres with Row Level Security, Edge Functions |
| Tests | Vitest 5 + Testing Library; Playwright for end-to-end |
| Quality | ESLint 9 (flat config), Prettier, `tsc -b` |
| CI | GitHub Actions: lint, format check, typecheck, tests and build on every pull request and push to the default branch. See `MILESTONES.md`. |

### 5.1 Folder structure

Inside `apps/student/`:

```
src/
  app/            router, providers, query client
  pages/          one folder per route (landing, auth, dashboard, courses, ...)
  layouts/        PublicLayout, AuthLayout, PortalLayout
  components/
    common/       shared app components (StatCard, EmptyState, StatusBadge, PageHeader)
    <feature>/    feature components (notes/, courses/, summary/, ai/, ...)
  features/auth/  AuthProvider, useAuth, RequireStudent route guard
  hooks/          TanStack Query hooks (useCourses, useNotes, useSummary, ...)
  services/       service interfaces + implementations
    mock/         in-memory/localStorage implementation and seed data
    supabase/     Supabase implementation (stubbed in v1)
  types/          domain types (section 12)
  lib/            utils, date formatting, sanitising, constants
  styles/         globals.css (imports the shared theme)
```

Shared with the other apps (D64): `packages/ui` holds the shadcn primitives, `cn`, the design tokens (`tokens.css`) and the Tailwind theme (`theme.css`); `packages/domain` holds the shared roles and statuses.

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

- **[Default]** Font: Plus Jakarta Sans, falling back to `system-ui`. It matches the geometric look of the wireframes. Loaded from Google Fonts in M1; self-hosted from M2.5 so it works offline and no request goes to Google (decision D23).
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
| Home (the dashboard) | `LayoutDashboard` | `/dashboard` |
| Courses | `BookOpen` | `/courses` |
| Notes | `NotebookPen` | `/notes` |
| Ask AI | `Sparkles` | `/ask-ai` |
| Notifications | `Bell` (unread count badge) | `/notifications` |
| Settings | `Settings` | `/settings` |

Classes are reached through a course, so they get no top-level item.

**Desktop (≥ 1024 px):** a fixed left sidebar, 240 px wide, with the logo at the top and the student's name and avatar at the bottom.
**Tablet (768–1023 px):** the sidebar collapses to an icon rail with tooltips.
**Phone (< 768 px):** a bottom tab bar with four tabs: Home, Courses, Notes and Ask AI (D35). The current tab has a filled pill behind its icon and a bolder label, so it is not shown by colour alone. Notifications is reached through the top-bar bell and Settings through the avatar menu. The bar, headers and sidebar keep clear of the iPhone notch and home indicator (`viewport-fit=cover` with `env(safe-area-inset-*)` padding).

**Top bar on every portal page:** the CoNote logo (phones only, linking Home), global search (placeholder "Find courses & notes", which fits from 360 px), a notification bell with the unread count (a badge showing 1–9, then "9+"; the exact count is in the link's accessible name), and an avatar menu (Profile, Settings, Install app where possible, Sign out).

**Placeholders:** pages not built yet say "Coming soon", never an internal milestone name.

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

- **FR-AUTH-1 Sign in** (`/login`): email, password (show/hide toggle), "Remember me", "Forgot password?" link, Sign In button, "or continue with" and a "Continue with Google" button (the official four-colour Google mark, following Google's sign-in branding), and the line "Don't have an account? Sign up".
- **FR-AUTH-2 Sign up** (`/signup`): full name, email, password, confirm password, a checkbox "I agree to the Terms of Service and Privacy Policy" (required), Sign Up button, the "Continue with Google" button, and the line "Already have an account? Sign in". New accounts get the `student` role.
- **FR-AUTH-3 Validation:** email format; password at least 8 characters with a letter and a number; confirm must match; full name 2–80 characters. Errors show inline under each field on blur and on submit.
- **FR-AUTH-4 Forgot password:** an email field. The page always shows "If an account exists for that email, we sent a reset link", so it never reveals whether an account exists.
- **FR-AUTH-5 Reset password:** new password and confirm. On success, go to `/login` with a success toast.
  - If the link is expired or already used, show "This reset link has expired" and a button back to `/forgot-password` to request a new one. The password fields are not shown.
- **FR-AUTH-6** Buttons show a loading state and are disabled while a request is in flight. Server errors appear in an alert above the form.
- **FR-AUTH-7 Mock mode:** any valid email and password signs in as the demo student. Google signs in as the demo student straight away.
  - Mock mode sends no email. After a reset request, the confirmation screen also shows a "Continue to reset (demo)" link to `/reset-password`. The link appears only in mock mode.
- **FR-AUTH-8 Supabase mode:** email/password auth plus the `google` OAuth provider. "Remember me" off means the session is kept in `sessionStorage`.

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
- **FR-AI-9** (D73, T0) While replies are canned (FR-AI-6), Ask AI is labelled "Preview": a badge beside the page heading, a one-line note under it ("Preview: replies are examples while the AI service is being built."), and the same badge on the Ask AI navigation item in the sidebar and the phone bar. On the 768–1023 px icon rail the badge is a small dot, and the word stays in the link's accessible name and tooltip. The label comes off when a real AI service replaces the canned replies.

### FR-NTF Notifications

- **FR-NTF-1** Tabs: All, Summaries, System, Messages.
- **FR-NTF-2** Each item shows an icon by type, title, body, relative time and an unread dot.
- **FR-NTF-3** Clicking an item marks it read and opens its link. "Mark all as read" appears in the page header.
- **FR-NTF-4** **[Default]** Messages are one-way announcements from teachers or admins. Students cannot reply, and there are no student-to-student messages.
- **FR-NTF-5** The unread count in the sidebar and bell updates as items are read.
- **FR-NTF-6** v1 fetches on page load and on window focus. Realtime push (Supabase Realtime) comes later.

### FR-SET Settings and Profile

- **FR-SET-1 Profile:** avatar (upload and preview, JPG or PNG, max 2 MB), full name, email (read-only; changed under Account), department, level/year, phone. Save Changes shows a toast.
- **FR-SET-2 Account:** change password (current, new, confirm), connected sign-in provider (Google), sign out, and "Request account deletion" (confirm dialog; mock shows a toast).
- **FR-SET-3 Notifications:** in-app and email toggles for "New summary published", "Class reminders" and "Announcements".
- **FR-SET-4 Privacy:** a plain-language explanation of who can see what (section 1 rules). **[Default]** "Download my notes" exports JSON.
- **FR-SET-5 Help & Support:** an FAQ accordion (at least 5 questions), a contact email, the app version, and "Reset demo data" in mock mode only.

---

### FR-PWA Installable app

**Level 1 (milestone M2.5): installable, app shell offline.**

- **FR-PWA-1 Manifest.**
  - `name` "CoNote", `short_name` "CoNote", `description` "Your notes. Collective understanding."
  - `id` and `scope` `/`; `start_url` `/dashboard` (a signed-out student lands on sign-in, then returns to the dashboard)
  - `display` `standalone`; `theme_color` `#4F46E5`; `background_color` `#F8FAFC`
  - The installed app shows sign-in and the portal only. Opening `/` in it goes to sign-in, and sign-out ends on sign-in. The landing page stays on the website. The Terms and Privacy links on sign-up open in a new browser tab (D36).
  - Icons: 192 px and 512 px PNG, a 512 px maskable icon, and a 180 px `apple-touch-icon`, all made from the logo mark
- **FR-PWA-2 Service worker.** Precaches the app shell: `index.html`, every JS and CSS chunk, the self-hosted font and the icons. Registered only in production builds.
- **FR-PWA-3 Offline navigation.** Any in-app path opened offline is served from the cached `index.html`, so client-side routes still work.
- **FR-PWA-4 Offline indicator.** When the browser reports it is offline, a banner under the top bar reads "You're offline. Some things may not load until you reconnect." It disappears on reconnect. Screen readers are told through `aria-live`.
- **FR-PWA-5 Updates.**
  - A new version never replaces the running one silently. A toast reads "A new version of CoNote is available" with a **Reload** button.
  - On a note editor page with unsaved changes, the toast waits until the note is saved or discarded, so an update never throws away writing.
  - The app checks for a new version when the student comes back to it (window focus, or the page becoming visible again, which is what iOS home-screen apps report), at most once every 15 minutes (D37).
- **FR-PWA-6 Install.**
  - Where the browser supports an install prompt, an "Install app" item appears in the avatar menu. It is hidden once installed or where unsupported.
  - On iOS Safari, the same item opens short instructions: Share, then "Add to Home Screen".
  - The public pages (landing, Terms, Privacy) show a "Get the CoNote app" strip at the top with an **Install app** button that does the same. It follows the same visibility rules and can be dismissed; the dismissal is remembered in the browser (D34).
- **FR-PWA-7 Sign-out and caches.** The precached app shell holds no student data and stays. Every runtime cache that holds student data (FR-PWA-8) is deleted on sign-out (NFR-4).

**Level 2 (with M4 and M5): offline reading.**

- **FR-PWA-8 Offline reading.** Notes and published summaries the student has opened stay readable offline.
  - TanStack Query's cache for those queries is persisted to IndexedDB, keyed by student ID, with a maximum age of 7 days.
  - Unpublished summaries and Ask AI conversations are never persisted.
  - Everything persisted is deleted on sign-out.

**Level 3 (backend stage, not scheduled): offline writing and push.**

- Notes written offline are queued and synced when the connection returns, with conflict handling.
- Push notifications for "summary published" and class reminders. On iOS these work only once the app is added to the home screen.

## 11. Cross-cutting states

Every data-driven view must have:

- **Loading:** skeletons shaped like the content, not spinners, for lists and cards
- **Empty:** an icon, one sentence and, where it makes sense, one action
- **Error:** a short message and a Retry button, plus a route-level error boundary for unexpected failures
- **Not found:** a missing course, class, note or summary ID shows an in-layout "not found" panel with a back link

Mutations (save note, delete note, mark as read, update profile) use optimistic updates where safe and roll back with an error toast on failure.

---

## 12. Data model

These are TypeScript domain types. Supabase column names are the snake_case forms of the same fields. `ID` below is shorthand for a record identifier; in the code it is a plain `string` (D65).

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
                    checkResetLink, resetPassword, updatePassword, getSession, onAuthChange
ProfileService      getMe, updateMe, uploadAvatar
CourseService       listMyCourses, getCourse
ClassService        listClasses(courseId), listMyClasses(range), getClass
NoteService         listMyNotes(filter), getNote, createNote, updateNote, deleteNote, exportMyNotes
SummaryService      listPublished(filter), getByClass(classId), markViewed
NotificationService list, markRead, markAllRead, unreadCount
AiService           askAi(context, messages) → AsyncIterable<string> | Promise<string>
SearchService       search(query)
```

`requestPasswordReset(email)` returns `{ demoResetPath? }`. Only the mock fills it in, so the forgot page shows the demo link without checking which data source is running (FR-AUTH-7). `checkResetLink(code)` returns whether a reset link is still valid; missing, made-up, used and superseded codes are refused (FR-AUTH-5). `resetPassword(code, newPassword)` checks the code again at the moment of the reset and spends it; `updatePassword` is only for a signed-in student changing their password (M5). In Supabase, `resetPassword` maps to exchanging the code for a recovery session and then updating the user.

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
  - Signing out clears the session, the TanStack Query cache and its persisted copy, runtime service-worker caches, unsent note drafts and the Ask AI conversation. The next person on a shared computer sees none of the previous student's data, even with the Back button or offline. Mock demo data (notes the student saved) stays, since it stands in for a server.
- **NFR-5 Code quality:** as defined in `ENGINEERING_STANDARDS.md` sections 3 and 4. In short: TypeScript strict with extra flags, zero ESLint errors, no `any`, enforced import boundaries, components under about 250 lines.
- **NFR-6 Testing:** test-driven development as defined in `ENGINEERING_STANDARDS.md` section 2. It covers unit, component, contract and end-to-end tests, with an 80% coverage floor on logic folders.
- **NFR-7 Browsers:** the latest two versions of Chrome, Edge, Firefox and Safari (desktop and iOS).
- **NFR-8 Installable app:** from M2.5,
  - Lighthouse reports the app as installable (valid manifest, service worker, icons)
  - with the network off, a previously visited student can open the app and move between pages
  - the precache stays under 2 MB
  - a Playwright test covers offline navigation and the update prompt

---

## 15. Decisions log

| # | Decision | Source of conflict | Default chosen |
|---|---|---|---|
| D1 | Ask CoNote AI | Wireframes only | Build the full UI with canned replies. Real model later. |
| D2 | AI grounding | Not specified | Approved summaries plus the student's own notes |
| D3 | Social sign-in | Brief: Google. Wireframe: Google and Microsoft | Google and Microsoft. **Replaced by D38.** |
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
| D20 | Library versions | Versions moved on since the plan was written | React 19, React Router 8, Vite 8, TypeScript 6, Node 22 LTS. ESLint stays on 9 until `eslint-plugin-jsx-a11y` supports 10. |
| D21 | Sign-out destination | Found while building M1 | Sign-out goes to the landing page. The guard does the redirect, so it never races a second one. Later visits to portal pages go to sign in as usual. |
| D22 | Progressive web app | Asked for after M1; not in the brief | Three levels: installable with the app shell offline (M2.5), offline reading (M4/M5), offline writing and push (backend stage) |
| D23 | Font hosting | Needed for offline use and a tighter CSP | Self-host Plus Jakarta Sans (SIL Open Font Licence) from M2.5; drop Google Fonts |
| D24 | Blocked upgrades | Dependabot opened ESLint 10, @eslint/js 10, TypeScript 7 and @types/node 26 (PRs #1–4, closed) | Ignored in `.github/dependabot.yml` until each blocker clears: major versions of ESLint, @eslint/js and @types/node, and TypeScript 6.1 or later (typescript-eslint supports below 6.1). Other updates continue |
| D25 | Reset success message | FR-AUTH-5 says "toast"; no toast library exists yet | The reset page sends a notice key in navigation state, and the sign-in page shows the fixed message in a `role="status"` box. Only known keys are shown, so injected state can't put text on screen. No new dependency. |
| D26 | Form handling | Needed for FR-AUTH-3 inline errors | `react-hook-form` with `@hookform/resolvers` and the shared zod schemas in `lib/authSchemas.ts`. The mock auth service checks the same schemas, so the rules hold even when the form is skipped. Errors show on blur and on submit. |
| D27 | Reset links | Found while building M2 | A reset code works once, and only the latest one works. The reset page checks the code before showing any field, and the service checks it again when the password is saved. A successful reset signs out any session on the device, so the sign-in page and its notice show. |
| D28 | Landing dashboard preview | Open question 5 | Drawn with styled boxes (`DashboardPreview.tsx`), so no image file is needed and it follows the design tokens. Can be swapped for a real screenshot later. |
| D29 | SonarCloud analysis | Automatic Analysis showed 0% coverage because it can't read coverage reports | Run the SonarCloud scan in CI after the tests, with `sonar-project.properties`. Coverage is measured on the same logic folders as Vitest. Automatic Analysis is turned off in SonarCloud, and the scan is skipped until the `SONAR_TOKEN` secret exists. |
| D30 | App icons | FR-PWA-1 needs PNG icons; no designer files yet | Drawn from the logo mark by `scripts/generate-icons.mjs` using the Chromium already installed for the browser tests, so no image library is added. The PNGs are committed; rerun the script when the logo changes. |
| D31 | Update toast | FR-PWA-5 names only "Reload" | A "Later" button hides the toast until the next update, so the student is never forced to reload mid-task. The app checks when the student comes back to it; see D37 for how often. |
| D32 | Offline banner placement | FR-PWA-4 says "under the top bar"; public and auth pages have no top bar | Shown at the top of the main content on every layout, as a polite live region, so it sits inside a landmark and is announced without interrupting. |
| D33 | Runtime cache names | FR-PWA-7 needs to find student-data caches | Every runtime cache is named `conote-runtime-…` (`RUNTIME_CACHE_PREFIX` in `lib/pwa.ts`); sign-out deletes those and keeps the precache. M4 and M5 must use the prefix. |
| D34 | Install offer for visitors | Asked for after M2.5: a way to get the app from the public page | A strip at the top of the public pages with an **Install app** button. It installs through the browser (Chrome and Edge dialog; iOS Add to Home Screen steps), since a web app has no file to download. Hidden where installing isn't possible or CoNote is already installed. Dismissable; the dismissal is kept in `localStorage` and holds no personal data. |
| D35 | Phone navigation | UX review after M2.5: five tabs felt packed; Notifications appeared twice (tab and bell) | Four tabs: Home, Courses, Notes, Ask AI (about 98 px each on a 390 px phone). Notifications moves to the top-bar bell with an unread badge. "Dashboard" is renamed "Home" in the nav and page heading; the address stays `/dashboard`. The phone top bar keeps its logo; the search placeholder is "Find courses & notes", the browser's own clear button is hidden (M5 adds one) and items sit 8 px apart on phones, so it fits at 360 px. |
| D36 | What the installed app contains | Asked for after the D35 review: the app should hold sign-in and the portal, not the public website | In the installed app (display mode `standalone`, or iOS `navigator.standalone`), `/` redirects to `/login` (`SkipLandingInApp`). This also makes sign-out there end on sign-in instead of the landing page (D21 still applies in the browser). Terms and Privacy stay reachable, since sign-up needs them, and open in a new tab. The precache is shared with the website, so the landing page's code is still cached for offline browser visits. |
| D37 | Update checks on iPhone | Found on a real iPhone after M2.5: a new version took several app restarts to appear | iOS home-screen apps often send no focus event when reopened, so the app also checks when the page becomes visible again (`visibilitychange`). The limit drops from once an hour to once every 15 minutes, so new deploys reach students sooner. Each check downloads nothing unless a new version exists. |
| D38 | Social sign-in (revised) | Asked for after M2: drop Microsoft, show the real Google logo | Google only, as the brief first said. One full-width "Continue with Google" button with the official four-colour "G" (inline SVG), white with a grey border as Google's branding asks. The `OAuthProvider` type is now `'google'` alone, so Microsoft can't come back by accident. |
| D39 | Home page heading | FR-DSH-1 asks for a greeting; D35 renamed the page "Home" | The greeting ("Good morning, Victory") is the page's `h1`. The tab title stays "Home", matching the tab bar. |
| D40 | Recent Activity source | FR-DSH-4 names events but no service returns them | Recent Activity shows the five newest notifications (`NotificationService.list()`), which already cover summaries, notes and announcements. No activity service is added. A notification link is used only if `isSafeRedirect()` accepts it; otherwise the row is plain text. |
| D41 | Tabs in the address | Section 7.2 puts the Course and Class tabs in `?tab=` | Unknown values fall back to the first tab (`parseTab`). Changing tabs replaces the history entry, so Back leaves the page instead of stepping through tabs. Tabs use Radix Tabs (already in `radix-ui`), so no dependency is added. |
| D42 | Class under the wrong course | Found while building the Class page | `/courses/A/classes/X` shows "Class not found" when class X belongs to another course, rather than showing it under the wrong heading. |
| D43 | Data loading rules | Section 11 states, M3 | Every hook converts failures to `AppError` (`appQuery`, now in `@conote/core`, D69) and query keys live in `hooks/queryKeys.ts`. A failed read is retried once, except for not found, forbidden, unauthorized, validation and conflict, which show at once (`lib/queryRetry.ts`). Every query error is reported once through the query cache. Pages refresh the clock every minute (`useNow`), so Live and Upcoming badges change while a page stays open. Dates are formatted by hand in `lib/dates.ts`, so tests don't depend on the machine's locale. Course icon colours come from the sum of the ID's character codes, which gives the four demo courses four different colours. |
| D44 | Toasts | FR-NTE-6 asks for a toast; D25 had avoided a library | A small toast provider, first in `features/toast`, now shared as `@conote/ui/toast` (D70): success toasts are polite status messages, errors are alerts, each closes after 5 seconds or with Dismiss, at most three at once. No dependency. |
| D45 | Offline store | FR-PWA-8 needs somewhere to keep notes | A small IndexedDB key-value store (`features/offline/idbStore.ts`), opened per call and closed after, so sign-out can always delete it. No wrapper library. Browsers without IndexedDB simply keep nothing. |
| D46 | Editor set-up | FR-NTE-2, D16 | Tiptap's starter kit with headings limited to two sizes (h2, h3) and strikethrough and horizontal rules turned off, because the sanitiser drops them. Links accept only http, https and mailto (`lib/links.ts`); a bare address gets https. |
| D47 | Drafts and leaving the editor | FR-NTE-5 | Drafts save 0.8 seconds after typing pauses, per note when editing and per class when new. While the Restore/Discard banner shows, nothing is saved over the draft. Cancel with changes asks "Discard your changes?" and deletes the draft. Leaving by any other link asks "Leave without saving?" and keeps the draft. Signing out is never blocked. |
| D48 | Optimistic note changes | Section 11 | Edits and deletes change the screen at once and roll back with an error toast if the service fails. Creating a note waits for the service, because the page then opens the saved note's class. Deleting returns to Notes straight away. |
| D49 | Offline copy of notes | FR-PWA-8, FR-PWA-7 | Notes, courses and classes that loaded successfully are saved to IndexedDB a second after changes pause. The copy is tagged with the student's ID, so another student's copy is discarded, never shown. It lasts 7 days and is marked stale when restored, so it refetches whenever the device is online. Sign-out deletes the database. The query cache keeps unused data for 7 days to match. |
| D50 | Demo notes | M4 "done when" (reload keeps notes) | The mock note service keeps notes in `localStorage` under `conote:mock:`, which sign-out keeps because it stands in for the server. It checks the note rules, the class, and cleans HTML before storing. A blank title becomes the first line, else "Untitled note". |
| D51 | Class of an existing note | FR-NTE-1 | When editing, the class is shown but can't be changed. The class picker appears only for a new note opened without a class. A `?classId=` that isn't one of the student's classes is ignored. |
| D52 | Loading a summary | FR-SUM-5, FR-SUM-6 | The summary is requested only once its class is known to be published and to belong to the course in the address. Otherwise the page shows the state card, and the service would answer "not found" anyway. Opening a published summary marks it viewed once, which refreshes Home's "New Summaries" count. |
| D53 | Ask CoNote AI conversations | FR-AI-2, FR-AI-6, FR-AI-7 | `askAi(context, messages)` returns the reply as one string; a streaming backend can add a second method later without changing the screens. A conversation lives in the page's memory only: never in storage, the query cache or the offline copy. `?courseId=` and `?classId=` count only for the student's own courses and classes. Beside a summary, the chat is a side panel from 1024 px and a bottom sheet below that; closing the sheet ends that conversation. |
| D54 | Notification tabs and reading | FR-NTF-1 to FR-NTF-5 | The tabs are the notification types; "note saved" items appear under All only. Opening an item marks it read, then follows its link if it stays inside CoNote. Items without a safe link are buttons. Marking is optimistic, and the bell and the sidebar show the same count. |
| D55 | Changing the password | FR-SET-2; M2 had `updatePassword(newPassword)` | `updatePassword(currentPassword, newPassword)`: the current password is required, so someone at an unlocked computer can't take over the account. The demo accepts any non-empty current password, as it does at sign-in; the backend will check it. |
| D56 | Support contact | FR-SET-5 asks for an email; none was given | `support@conote.example` (`SUPPORT_EMAIL` in `HelpTab.tsx`), a reserved placeholder domain, until the school provides a real address. |
| D57 | Profile and picture | FR-SET-1 | Saving a new name updates the session too, so the navigation changes at once (as Supabase's USER_UPDATED will). Pictures must be JPG or PNG of 2 MB or less; SVG is refused because it can carry scripts. The demo keeps the picture as a data address, and the service accepts only an image data address. Notification settings are part of the profile. |
| D58 | Reset demo data | FR-SET-5 | A `demo` service exists only in mock mode, so the button can't appear with a real backend. It removes every `conote:mock:` key (notes, profile, viewed and read state) and reloads. |
| D59 | Global search | Section 8 names a SearchService | v1 searches the course, class and note lists the app already caches, in the browser. It needs 2 or more characters and shows up to 5 results per group. There is no separate search service until the backend adds full-text search. The box is an ARIA combobox: arrows, Enter, Escape, and a clear button that works in every browser. |
| D60 | Offline summaries | FR-PWA-8 | Published summaries join notes, courses and classes in the offline copy. Drafts can't be stored, because the summary service never returns them, and Ask AI conversations are never stored. |
| D61 | Splash screen | Asked for after M5 | A branded splash (indigo, the reversed logo tile, the name, the tagline and three pulsing dots) is written into `index.html`, so it paints before any script loads. The app removes it with a 250 ms fade once the first page's code has loaded and sign-in is known, so no loading spinner flashes. The error screen removes it too, so a crash is never hidden. Reduced motion turns off the pulse and the fade. The manifest's background colour is now the brand indigo, so Android's launch screen flows into it. Ten iPhone launch images (one per screen size, drawn by `scripts/generate-icons.mjs`) replace iOS's white launch screen; they are left out of the offline download. |
| D62 | Launch without black or white screens | Reported after D61: a first open showed black, then white, then the splash | **White:** the built page linked its stylesheet in the head, and a browser draws nothing until such a file has downloaded, so the splash waited behind a blank page (2,084 ms on a throttled test connection). A build step (`src/lib/inlineStylesheets.ts`, wired in `vite.config.ts`) now puts the stylesheet inside `index.html` and drops the separate file; the first paint came at 56 ms in the same test. The build fails if the CSS contains `</style` or relative `url()` paths. **Black:** iOS shows its own launch screen until the page paints, and uses the launch images only for pages marked as home-screen web apps, so `apple-mobile-web-app-capable` (and `mobile-web-app-capable`) were added, plus a launch image for iPhone Air (1260x2736). iOS fetches launch images and the icon when the app is added to the home screen, so an existing install must be removed and added again. `e2e/pwa.spec.ts` checks the first paint happens under 1 s with every built file delayed by 2 s. |
| D63 | Minimum splash time | Asked for after D62: the splash left too quickly | The splash stays up for at least 1.5 s from launch (`SPLASH_MIN_MS` in `src/lib/splash.ts`), then fades over 250 ms as before. On a fast start it previously left after about 0.7 s. If loading takes longer than 1.5 s, it leaves as soon as the first page is ready, so nothing gets slower. Time is measured with `performance.now()`, which counts from the start of page load. A page crash still removes it at once (`RouteErrorBoundary`). Covered by unit tests in `splash.test.tsx` and a timed check in `e2e/pwa.spec.ts`. |
| D64 | Monorepo for all portals | The admin portal brief asked for separate frontends on one backend; the student portal's docs already said so | One repository with npm workspaces. `apps/student` is the student portal, moved without behaviour changes; `apps/admin` and `apps/teacher` will join it. Shared code lives in packages: `@conote/ui` (tokens, Tailwind theme, shadcn-style primitives, `cn`) and `@conote/domain` (roles, and course, summary and notification statuses). Packages are compiled from source by each app, with no build step, and may not import app code (ESLint). One root config each for ESLint, Prettier, TypeScript (project references), Vitest (one project per app, coverage at the root) and lint-staged. Rejected: one app for every role, because admin and teacher code would ride along in the student PWA's offline download and every admin release would prompt students to update; separate repositories, because shared names and statuses drift apart. Vercel keeps deploying from the root `vercel.json`, which now builds `@conote/student`; each future app gets its own Vercel project. Tailwind now scans only the app and `packages/ui`, so two unused classes that came from words in the docs (`grow`, `contents`) are no longer generated. |
| D65 | Record IDs are plain strings | SonarCloud rule "redundant type alias" on `type ID = string` once the alias moved to `@conote/domain` | The `ID` alias is gone; IDs are typed `string` everywhere. The alias added no type safety (any string fitted), and field and parameter names (`courseId`, `noteId`) already say what each string identifies. Section 12 keeps `ID` as shorthand. |
| D66 | Admin portal app | Admin milestone A1 | `apps/admin` (`@conote/admin`) in the monorepo, deployed as its own Vercel project with Root Directory `apps/admin` and its own `vercel.json` (the student headers plus `X-Robots-Tag: noindex, nofollow`). Desktop-first web app: no PWA and no launch splash. Every route sits under `/admin`. Demo sign-in with one account per role and the password `password1`; the session is kept in session storage, so closing the tab signs out. Sign-in rejects unknown emails and wrong passwords with one message (no account enumeration). A route guard admits only `role = 'admin'`; students and teachers see a notice. This is UX only: the backend's RLS and admin-only server functions enforce it (backend stage). Sign-out clears the query cache and every `conote-admin:` storage key. Root `build`, `size` and `e2e` now run in every app, so CI covers the admin app. Requirements and milestones: `docs/admin/`. |
| D67 | More shared code before the admin app | Admin milestone A1 needed code the student app already had | Moved instead of copied: `@conote/core` (new: `AppError`/`toAppError`, `isSafeRedirect`/`safeRedirectTarget` with the fallback page as a parameter, `reportError`, `parseEnv`, `assertNever`, `initials`), `@conote/ui/common` (`Logo`, `PageTitle`, `FullPageLoader`, `PlaceholderPage`, `SidebarLink`; `react-router` becomes a peer dependency), `@conote/ui/forms` (`FormField`, `FormMessage`, `PasswordInput`), `@conote/testing` (new, test-only: the common Vitest setup, the axe helper, and the Playwright axe and CSP helpers). Error wording stays per app, since students and administrators are told different things. `Sheet` gained a `left` side for the admin phone menu. No change for students. |
| D68 | Admin password recovery and shared password rules | Admin milestone A2 | Forgot and reset password in the console (`docs/admin/REQUIREMENTS.md` section 9). Admins choose passwords of at least 12 characters with a letter and a number, longer than the students' 8, because an admin account can change the whole platform. The rules come from one shared factory, `createNewPasswordSchema(minLength)` in `@conote/core`; the student app now builds its 8-character rule from it. The sign-in notice ("Your password has been updated…") comes from the shared `createNavigationNotices`, which accepts only known keys from navigation state. Reset links are unguessable, work once, are replaced by a newer request, and are checked again when saving. A request for an unknown email looks the same as for a real one (no account enumeration); in the demo it simply changes nothing. The demo keeps changed passwords under `conote-admin-demo:` in local storage, which sign-out doesn't clear, so they behave like server data. The two recovery forms are shared as well, `@conote/ui/forms/ResetRequestForm` and `NewPasswordForm`: each app passes its own rules, wording and page frame, so the markup lives once. |
| D69 | Admin dashboard data and chart | Admin milestone A3 | **Data:** the admin demo serves one seeded platform (`apps/admin/src/services/mock/seed/platformSeed.ts`): users, courses, classes, summaries, AI jobs, 90 days of `activity_events`, notification and storage failures, security events and the settings the dashboard reads. It is built relative to the current time from a fixed pseudo-random sequence, so the same clock gives the same data. Its first four courses use the student portal's demo IDs, titles and teachers. The services read it through one record shape (`services/platformData.ts`), which contract tests also use for their own small fixtures, so the Supabase services must count the same way. **Services:** `AnalyticsService.getOverview` and `AlertService` are added to the admin spec's service list. **Chart:** the one dashboard chart is hand-written SVG (line, wash, crosshair, HTML labels, table view) instead of a chart library: no new dependency, and nothing extra in the bundle. **Shared code:** `StatCard` moved to `@conote/ui/common`; a new `ErrorPanel` there is used by both apps' load-error states; `appQuery` moved to `@conote/core`. **Vocabulary:** `AccountStatus` and `AiJobStatus` added to `@conote/domain`. |
| D70 | Admin Users | Admin milestone A4 | **Records:** `UserRecord` gains student and staff numbers, department, level, phone, created and last-active times; `PlatformData` gains `enrollments` and `auditLog`. A user's status history is read from the audit log, not stored twice. **Rules** (shared by the screens and the demo service, and to be enforced by the Edge Functions): the allowed status changes in `lib/userStatus.ts`; no administrator changes their own status; reset links go to active accounts only; one account per email, compared in lower case. **Demo persistence:** users, enrolments and the audit log are saved in local storage under `conote-admin-demo:platform` and restored over the seed, checked with zod; sign-out keeps them, like server data. **Sign-in:** the demo refuses accounts that are not active, as the backend will. **Phone tables:** one table restyles as cards below the tablet width, each cell labelled with its column name, rather than separate phone markup. **Shared:** `ConfirmDialog`, `EmptyState` and the toasts move to `@conote/ui` (`common/`, `toast`), and `NativeSelect` is added; the toasts take `aboveBottomNav` for the student app's phone bar. |
| D71 | Admin Courses | Admin milestone A5 | **Records:** `CourseRecord` gains description, department, status, teacher and archive time; `ResourceRecord` is added, and both are saved in the demo with the users. **Rules** (shared by the screens and the demo service, and to be enforced by the database and Edge Functions): course codes are stored upper case with one space and are unique whatever the letter case, archived courses included; only an active teacher can be assigned, except that an edit may keep a teacher who has since been deactivated; an archived course refuses edits, teacher changes and enrolment changes; students who are not active, or are not students, are never enrolled. **Bulk enrolment** reads at most 500 emails or student numbers from pasted text or a file under 200 KB, previews them (matched, already enrolled, unmatched with a reason) and enrols only the matched. **Audit:** `course.*` and `enrollment.*` actions with the course as the entity. **Shared:** `DataTable` and `SearchField` moved out of Users into `components/common`; `Textarea` added to `@conote/ui`. |
| D72 | Admin Classes | Admin milestone A6 | **Records:** `ClassRecord` gains a per-course number, an end time, a description and a count of notes contributed (a count only; the admin portal never holds note content); `AiJobRecord` gains its queued time and attempt number. **Rules** (shared by the screens and the demo service, and to be enforced by the database and Edge Functions): the end time is after the start time; a class is numbered after the course's highest number, archived classes included, and keeps its number; a class cannot move to another course; new classes go to courses in use only; an archived class refuses changes. **Archive only:** the spec lists no restore for classes, so none is built; an archived class keeps its notes and summary and is hidden from students and teachers. **Timeline:** the summary's stages are read from the summary record and the class's first AI job, not stored separately. **Demo persistence:** classes, summaries and AI jobs are saved and restored together, because the demo seed is built around the current time and a restored class must agree with the summary that describes it. **Audit:** `class.*` actions with the class as the entity. |
| D73 | MVP focus | Planning review after admin milestone A6 | **Goal:** run the core loop for real (admin sets up, students write notes, the AI drafts, a teacher approves, students read) and park everything else. **Remaining milestones:** T0 Ask AI preview label, T1 teacher spec and shell, T2 teacher review flow on demo data, B1 backend foundation, B2 real data for admin and student, B3 summary pipeline and the teacher portal on real data, B4 minimum ops, B5 launch. **Parked (Post-MVP):** admin A7 Resources, A8 beyond failed jobs and Retry, A9 Analytics and audit viewer, A10 Settings and the admin notifications page; Google sign-in; PWA level 3; full-text note search; real Ask AI answers; teacher extras. **Choices:** sign-up is left as built; the teacher portal is built on demo data first, like the other two; Ask AI keeps its canned replies, labelled "Preview". **Limit of demo data:** the three apps are separate origins with separate demo storage, so a summary a teacher publishes in the teacher demo can't appear in the student demo. The hand-off is proved by the review service contract (T2) and by the real loop (B3). **Open question 4** (who may sign up) must be answered before B1. |

---

## 16. Build milestones

The full task lists and completion checks are in [`MILESTONES.md`](./MILESTONES.md).

**Since D73, the remaining work is the MVP plan (T0 to T2, B1 to B5)**, listed with the parked items in [`MILESTONES.md`](./MILESTONES.md#mvp-milestones-d73). Student M6 is folded into B5.

| # | Milestone | Done when |
|---|---|---|
| M1 | Project setup | Vite + TS + Tailwind + shadcn set up; tokens in place; router with all routes stubbed; layouts responsive; mock auth and guard working |
| M2 | Public pages | Landing, sign in, sign up, forgot and reset password complete with validation |
| M2.5 | Installable app (PWA) | Installable from the browser; app shell works offline; update prompt; font self-hosted; CSP updated |
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
5. ~~Is there a real dashboard preview image for the landing page?~~ Built from components for now (D28).
6. Will she provide a logo file, or should a text-and-icon logo be made from Lucide?
