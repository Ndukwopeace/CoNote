# CoNote Student Portal — Build Milestones

These milestones break the work in [`REQUIREMENTS.md`](./REQUIREMENTS.md) into seven stages (M1 to M6, plus M2.5). Every milestone follows [`ENGINEERING_STANDARDS.md`](./ENGINEERING_STANDARDS.md), and nothing counts as done until its Definition of Done is met. Each stage ends with something that can be opened in a browser and checked. They are a planning aid added during review; they were not part of the original brief.

> **Current plan (D73):** the work now concentrates on the MVP. The student portal (M1 to M5) and admin milestones A1 to A6 are done. Everything still to build is in [MVP milestones](#mvp-milestones-d73) at the end of this file; everything else is parked under [Post-MVP](#post-mvp).

## How this build handles the backend

The brief asks for a "Supabase-ready architecture" and says the portal will *eventually* share a backend with the teacher and admin portals. So every milestone runs in the browser on demo data.

- Pages get data only through service functions (`listMyCourses`, `createNote`, and so on).
- In v1 those functions return seeded demo data. Anything a student creates is saved to `localStorage`.
- Connecting Supabase later means writing a second implementation of the same functions. Pages do not change.

**Works for real in the demo:** navigation on every screen size; creating, editing and deleting notes (they survive a reload); search, filters, read/unread notifications, profile edits.

**Faked in the demo:**

- **Login.** Any valid email and password signs in as the demo student.
- **Other users.** Courses, teachers and summaries are pre-written.
- **Ask AI.** Replies are canned text.
- **Storage.** Data lives in one browser only.

---

## M1 — Project setup

**Covers:** section 5 (technology and folders), section 6 (design system), section 7 (routes), section 8 (navigation), FR-AUTH-7.

- Vite + React + TypeScript (strict), Tailwind, shadcn/ui, React Router, TanStack Query, ESLint, Prettier, Vitest
- Quality tooling from `ENGINEERING_STANDARDS.md`:
  - compiler flags (section 4.1)
  - ESLint rules and import boundaries (sections 3.1 and 14)
  - coverage thresholds (section 2.6)
  - Husky + lint-staged (section 13)
  - `size-limit` (section 8)
  - Playwright with one smoke test
  - test factories and `ServicesProvider` test helper
  - PR template carrying the Definition of Done
  - Dependabot config
- Security groundwork: `SafeHtml`, `isSafeRedirect`, `lib/env.ts` zod check, `AppError` + `reportError`, and security headers in `vercel.json` (standards sections 5 and 6)
- Colour, radius and font tokens in `src/styles/tokens.css`; Tailwind reads from them
- Folder structure from section 5.1
- Every route from section 7 registered, with placeholder pages
- `PublicLayout`, `AuthLayout` and `PortalLayout`:
  - desktop: sidebar
  - tablet: icon rail
  - phone: bottom tab bar
  - top bar with search box, bell and avatar menu
- Service interfaces plus the data-source switch (`VITE_DATA_SOURCE`)
- Mock auth service, `AuthProvider`, and the `RequireStudent` guard with the `?redirect=` return
- Sign-out that clears the session, query cache, drafts and AI conversation (NFR-4)
- GitHub Actions CI workflow (see "Continuous integration" below)
- First deployment to Vercel (see "Deployment" below)

**Done when:** a visitor can "log in" and click through every (empty) portal page at 360 px, 768 px and 1440 px wide. Signing out returns to the landing page. Portal URLs redirect to login when signed out. All of this works on the live Vercel URL, including opening a deep link such as `/courses` directly or refreshing on it. CI passes on the pull request that carries M1.

### Continuous integration

A GitHub Actions workflow at `.github/workflows/ci.yml` checks every change. It is added in M1, once `package.json` exists; before that it would have nothing to run.

- **Triggers:** every pull request, and every push to the default branch.
- **Environment:** `ubuntu-latest`, Node 22 LTS, with the version pinned in `.nvmrc` so CI, Vercel and local machines match. The npm cache is keyed on `package-lock.json`.
- **Steps, in order:**
  1. `npm ci`
  2. `npm run lint` (ESLint, zero errors)
  3. `npm run format:check` (Prettier)
  4. `npm run typecheck` (`tsc --noEmit`)
  5. `npm test -- --run --coverage` (Vitest, no watch mode; fails below the coverage floor)
  6. SonarCloud scan with the coverage report (skipped until the `SONAR_TOKEN` secret exists)
  7. `npm run build`, with `VITE_DATA_SOURCE=mock`
  8. `npm run size` (bundle budget)
  9. `npm run e2e` (Playwright against the built app, with axe checks)
  10. `npm audit --audit-level=high`
  11. gitleaks secret scan
- **Hardening:** actions pinned to commit SHAs; `permissions: contents: read` (standards section 6.7).
- **Concurrency:** a new push to the same branch cancels the run still in progress for that branch.
- **Branch protection:** once the first run is green, require the CI check to pass before merging into the default branch. This is a repository setting, changed by the repo owner in GitHub.
- **CI does not deploy.** Vercel's GitHub integration builds and deploys on its own. CI only decides whether a change is safe to merge.
- **Later additions:**
  - M2–M5: a Playwright test for each critical flow as it is built (standards section 2.3)
  - Backend stage: Supabase secrets stored as GitHub Actions secrets, never in the workflow file

### Deployment

Hosting is on Vercel, starting at the end of M1. Every later milestone ships to the same project.

- **Build settings:** framework preset "Vite", build command `npm run build`, output directory `dist`.
- **Client-side routes:** add a `vercel.json` that rewrites every path to `/index.html`. Without it, refreshing on `/dashboard` or opening a shared link returns a Vercel 404.

  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

- **Environment variables:** set `VITE_DATA_SOURCE=mock` for Production and Preview. The Supabase variables are not needed until the backend stage. Vite bakes `VITE_*` values in at build time, so changing one needs a redeploy.
- **Branches:** production deploys from the default branch. Every other pushed branch gets its own preview URL, so each milestone can be reviewed before it is merged.
- **Demo data on the live site:** it is stored per visitor, per browser. Two people testing the same URL do not see each other's notes.

---

## M2 — Public pages

**Covers:** FR-LND-1 to FR-LND-6, FR-AUTH-1 to FR-AUTH-6.

- Landing page:
  - header, with a phone menu
  - hero with the dashboard preview
  - six-step How It Works
  - features grid, About, call-to-action band and footer
- Sign in, sign up, forgot password and reset password pages, including the expired-link state and the mock-only reset shortcut (FR-AUTH-5, FR-AUTH-7)
- zod validation schemas with inline errors
- Loading and disabled states on submit
- Google sign-in button (mock sign-in; Microsoft dropped in D38)
- Placeholder `/terms` and `/privacy` pages
- Unit tests for the validation schemas

**Done when:** a new visitor can go from the landing page through sign-up to the dashboard, and every form rejects bad input with a clear message.

---

## M2.5 — Installable app (PWA)

**Covers:** FR-PWA-1 to FR-PWA-7, NFR-8, decisions D22 and D23.

Added after M1 at the team's request. It comes straight after M2 so the icons use the final branding. It lands before the feature milestones so that every later milestone is built and tested with the service worker already in place.

- `vite-plugin-pwa` in `generateSW` mode with `registerType: 'prompt'`. Its PR states the reason, size and licence (standards section 10).
- Manifest and icons from FR-PWA-1: 192, 512, maskable 512 and a 180 px `apple-touch-icon`, generated from the logo mark and committed as files
- Precache the app shell and a navigation fallback to `index.html` (FR-PWA-2, FR-PWA-3)
- Self-host Plus Jakarta Sans (D23): remove the Google Fonts `<link>` from `index.html` and the Google domains from the CSP
- `vercel.json`:
  - CSP gains `worker-src 'self'` and `manifest-src 'self'`
  - `Cache-Control: no-cache` on `/sw.js` and `/manifest.webmanifest`, so browsers always check for a new version (the app registers the worker itself, so no `registerSW.js` is generated)
- Offline banner (FR-PWA-4)
- Update toast that waits while a note has unsaved changes (FR-PWA-5). In M2.5 the "unsaved changes" signal is a small shared flag that M4's editor will set.
- "Install app" item in the avatar menu, with iOS instructions (FR-PWA-6)
- `clearUserData` extended to delete runtime caches on sign-out (FR-PWA-7). In M2.5 there are none yet, so this is the hook M4 and M5 will use.
- **Tests first for:**
  - the update-toast rules
  - the install-item visibility rules
  - the offline banner
  - cache clearing on sign-out
  - a Playwright test that loads the app, goes offline, and still navigates between pages
- Size budget: the precache stays under 2 MB (NFR-8); `size-limit` still guards the entry chunk

**Done when:**
- Chrome offers to install CoNote, and the installed app opens full-screen at the dashboard.
- With the network off, a returning student can open it and move between pages.
- A new deploy shows the update toast instead of swapping versions silently.
- The CSP still reports no violations in the browser tests.
- Lighthouse marks the app installable.

---

## M3 — Courses and classes

**Covers:** FR-DSH-1 to FR-DSH-6, FR-CRS-1 to FR-CRS-4, FR-CLS-1 to FR-CLS-6, section 11, section 13.

- Seed data from section 13, with class dates generated relative to today
- Dashboard: greeting, four stat cards, Upcoming Classes, Recent Activity, Ask AI card, no-courses empty state
- My Courses, with search and a status filter kept in the URL
- Course Details, with four tabs (the Notes and Summaries tabs may show placeholders until M4 and M5)
- Class page:
  - three tabs
  - summary state card (section 4)
  - privacy banner
  - Previous/Next links
- `/classes`, grouped into Today, Upcoming and Past
- Shared `StatusBadge`, `CourseIcon`, `EmptyState`, `StatCard` and loading skeletons
- Loading, empty, error and not-found states on every view

**Done when:** every course and class in the seed data can be reached from the dashboard. Live and Upcoming badges match the clock. Each view shows a sensible screen while loading, when empty, and when a request fails.

---

## M4 — Notes

**Covers:** FR-NTE-1 to FR-NTE-10.

- Tiptap editor with the toolbar from FR-NTE-2
- Tag picker with presets and custom tags
- Create and edit forms:
  - class picker when not opened from a class
  - validation
  - unsaved-changes prompt
  - draft autosave to `localStorage`, with a Restore/Discard banner when the editor reopens (FR-NTE-5)
- Read view, with the HTML sanitised by DOMPurify
- Notes page: My Notes tab, course filter, search, sort, row menu (Open, Edit, Delete)
- Delete confirmation
- Optimistic updates with rollback
- Notes wired into the Course Details and Class Notes tabs
- Notice when editing a note on a class whose summary is already published
- Offline reading for notes (FR-PWA-8): persist note queries to IndexedDB, wipe them on sign-out; set the "unsaved changes" flag the update toast reads (FR-PWA-5)
- Component tests for the note form

**Done when:** a student can write a note for a class, find it from the class, the course and the Notes page, edit it, reload the browser without losing it, and delete it.

---

## M5 — Summaries, Ask AI, notifications, settings

**Covers:** FR-SUM-1 to FR-SUM-6, FR-AI-1 to FR-AI-8, FR-NTF-1 to FR-NTF-6, FR-SET-1 to FR-SET-5.

- Summary view:
  - header with reviewer and note count
  - AI Summary and Key Topics tabs
  - approval label
  - "mark as viewed"
- Ask AI side panel on the summary (a bottom sheet on phones)
- Ask CoNote AI page:
  - context picker; changing it starts a new conversation (FR-AI-2)
  - suggested prompts
  - Enter to send
  - typing indicator
  - retry on error
  - canned replies
- Summaries tab on the Notes page and on Course Details
- Notifications: four tabs, unread dots, mark as read, mark all read, live unread count in the nav
- Settings: Profile, Account, Notifications, Privacy (JSON export), Help & Support (FAQ, reset demo data)
- Global search in the top bar
- Offline reading for published summaries (FR-PWA-8); unpublished summaries and Ask AI conversations are never persisted
- Component tests for the summary state card and the auth guard

**Done when:** every screen in `wireframes/student-portal.jpg` exists and works on demo data. A summary that is not published never shows its content.

---

## Admin portal

The admin console's milestones are tracked in [`admin/MILESTONES.md`](./admin/MILESTONES.md). A1 to A6 are done. A7 to A11 are post-MVP (D73); the admin work the MVP still needs is inside B2 and B4 below.

---

## Restructure — Monorepo (D64)

Done between M5 and M6, before the admin portal starts. No change for students.

- The student portal moved to `apps/student` with its history kept (`git mv`).
- Shared packages: `packages/ui` (tokens, Tailwind theme, UI primitives, `cn`) and `packages/domain` (roles and statuses).
- One root config each for ESLint, Prettier, TypeScript, Vitest and lint-staged, covering every app and package. CI runs the same commands from the root.
- Vercel deploys the student app from the root `vercel.json` without a settings change. Each new app gets its own Vercel project with its folder as the Root Directory.

**Done when:** the full gate passes from the root with the same results as before the move: unit tests and coverage, build, bundle budget, end-to-end tests, and an unchanged production deploy.

---

## M6 — Finishing

**Covers:** section 14.

- Accessibility pass:
  - keyboard-only walkthrough of every page
  - focus rings and labels
  - `aria-live` on chat and toasts
  - badge contrast
  - reduced-motion support
- Responsive pass at 360, 768, 1024 and 1440 px
- Code-split routes; check bundle size and landing-page load time
- Lint, typecheck and tests all passing in CI
- Every critical flow in standards section 2.3 covered by a Playwright test
- Security headers verified on the production URL; Lighthouse check on the landing page
- `README.md`: setup, scripts, environment variables, folder guide, and how to switch to Supabase

**Done when:** the app is ready to demo or hand over, and a new developer can run it from the README alone.

---

## MVP milestones (D73)

**The MVP is the core loop running for real:** an admin sets up people, courses and classes → students write private notes → the AI drafts a summary → a teacher reviews and approves it → students read it. Anything outside that loop waits (see [Post-MVP](#post-mvp)).

**Order:** the teacher portal is built on demo data first (T1, T2), the way the student and admin portals were, so the review flow and its service contract are proven before any SQL is written. The backend stage (B1 to B5) then connects all three portals.

**Already done:** student portal M1 to M5, the monorepo restructure (D64), admin A1 to A6. Student M6 (finishing) and admin A11 are folded into B5.

| #   | Milestone                                                                            | Size |
| --- | ------------------------------------------------------------------------------------ | ---- |
| T0  | Ask AI marked as a preview (student portal)                                          | XS   |
| T1  | Teacher spec and shell                                                               | S    |
| T2  | Teacher review flow on demo data                                                     | M    |
| J1  | Course join requests (student request, admin approval) on demo data                  | M    |
| B1  | Backend foundation                                                                   | L    |
| B2  | Real data for admin and student                                                      | L    |
| B3  | Summary pipeline, and the teacher portal on real data                                | L    |
| B4  | Minimum ops: failed jobs and retry, in-app notifications                             | S    |
| B5  | Launch: accessibility and responsive pass, runbook, production deploy, pilot class   | M    |

### T0 — Ask AI marked as a preview

**Covers:** the "nothing fake" rule (admin REQUIREMENTS section 23). Ask AI answers with canned text; it stays in the MVP, labelled honestly.

- A "Preview" badge beside the Ask AI heading, and a one-line note under it: replies are examples while the AI service is being built.
- The same badge on the Ask AI navigation item, so nobody meets the canned replies unlabelled.
- No other change to how Ask AI works.

**Done when:** the badge and note show at 360 px and 1440 px, a component test and a Playwright check cover them, and the student docs mention the label.

### T1 — Teacher spec and shell

**Covers:** the missing teacher requirements, and `apps/teacher`.

- Write [`docs/teacher/REQUIREMENTS.md`](./teacher/REQUIREMENTS.md), in the same shape as the admin spec:
  - routes and screens: My courses, Course, Review queue, Review summary
  - rules: a teacher sees only the courses they teach; what the teacher sees of the students' notes while reviewing (the draft only, or the contributing notes) is decided here and recorded as a decision
  - states and messages
  - the service list: for example `listReviewQueue`, `getDraft`, `saveDraft`, `approveAndPublish`
- `apps/teacher` (`@conote/teacher`) from the admin app's pattern: Vite, the shared packages, routes under `/teacher`, a `RequireTeacher` guard that turns away other roles, and the console frame.
- Demo sign-in as `teacher@conote.example`.
- Own Vercel project with Root Directory `apps/teacher` and its own `vercel.json`; `build`, `size` and `e2e` already run in every app, so CI covers it.

**Done when:** a teacher signs in and sees My courses (their courses from the teacher demo's own seed, whose MTH 202 matches the admin demo's, D74), other roles are turned away, signed-out visitors go to sign-in, and the full gate passes.

### T2 — Teacher review flow on demo data

**Covers:** the teacher half of the loop, using the teacher spec.

- My courses and course details (classes with their summary stages).
- The review queue: summaries waiting in `in_review` for the teacher's courses, longest wait first.
- The review screen: read the draft, edit it, save the draft, and "Approve & Publish", which asks first. Only a teacher can publish; there is no publish action anywhere else.
- The review service contract, written so the student's summary service and the backend read the same statuses.
- Loading, empty, error and not-found states on every screen; Playwright covers the review flow.

**Done when:** in the teacher demo, a draft can be edited and published, and the summary moves to `published`. The student portal's demo is a separate app with its own storage, so the hand-off between the two apps is shown by contract tests now and by the real loop in B3.

### J1 — Course join requests

**Covers:** FR-ENR in the student requirements and the Requests tab in admin REQUIREMENTS section 12 (decision D76). New students sign up openly, so they need a way to reach a course.

- **Student portal:** the "Join your courses" dialog after sign-up, "Find courses" on the dashboard empty state and My Courses, and the Requested courses section. The services in FR-ENR-6, with a contract test.
- **Admin console:** a Requests tab on the course page (pending requests with name, email, student number and date), with Approve and Decline. Approving enrols the student, as bulk enrolment does, and writes `enrollment_request.approved` and `enrollment.added` to the audit log; declining writes `enrollment_request.declined`. An archived course refuses both. A dashboard alert, "Students waiting to join a course", links to the course.
- **Both apps:** loading, empty, error and not-found states; component tests and Playwright for each flow.
- **Docs:** a new `enrollment_requests` table in admin REQUIREMENTS 6.2 and the student data model.

**Done when:** in the student demo a new student can search, request, cancel and re-request a course; in the admin demo a request can be approved or declined and the roster follows. The demos are separate origins, so the hand-off between them is shown by the contract tests now and by the real loop in B2.

### B1 — Backend foundation

**Covers:** the shared Supabase project (admin REQUIREMENTS sections 6 and 20; student REQUIREMENTS section 12).

- Supabase projects for development and production; migrations in the repository.
- The tables from student REQUIREMENTS section 12.2 and admin section 6.2, with Row Level Security from admin section 6.3.
- Email and password sign-up and sign-in as the student portal already offers them (D73: sign-up is left as built; D76: it stays open to anyone, with email confirmation switched on). Public sign-up is enabled in Supabase, and a new account is a `student`; teachers and admins are invited. The `enrollment_requests` table and its Row Level Security (a student reads and cancels only their own; admins read and decide) come with the tables above.
- Audit triggers, a seed script that mirrors the demo data, and secrets in Supabase and GitHub Actions secrets (never in the repository).

**As built (D78):** `supabase/migrations` (schema, Row Level Security, functions and audit), `supabase/seed.sql`, `supabase/config.toml` and `supabase/tests`; run the tests with `npm run test:db` (CI job "Database security tests"). Still to do by hand: create the development and production Supabase projects, apply the migrations (`supabase db push`), switch on email confirmation, and store the keys as secrets. The Edge Functions are B2.

**Done when:** the automated security checks in admin REQUIREMENTS section 25 pass against the database: a student or teacher gets 403 from admin functions, a teacher can't update another teacher's course, a student can't update a summary, and an admin can't read `notes.content_html`.

### B2 — Real data for admin and student

- Supabase implementations of the services behind the existing interfaces, with the contract suites run against both the demo and Supabase:
  - admin: Auth, User, Course, Class
  - student: Auth, Course, Class, Note, Profile, Notification, Summary
- Edge Functions `invite-user`, `set-user-status` and `send-password-reset`, each verifying the caller is an active admin, validating input, and writing the audit entry.
- Each app switches with `VITE_DATA_SOURCE=supabase`; pages do not change.

**Progress (D79):** B2.1 is built: the `@conote/supabase` package and the student's Supabase sign-up, sign-in, sign-out, session and password reset, with the CI job that runs the auth contract against a local Supabase stack. **B2.2 (D80)** adds the student's courses, classes and join requests on Supabase, and the join loop is tested end to end in CI (a student asks, an administrator decides through `decide_enrollment_request`). **B2.3 (D81)** adds the student's notes and published summaries on Supabase, with privacy and draft-hiding proved against the real stack in CI. **B2.4 (D82)** adds the student's notifications and profile, which finishes the student app except Ask AI (B3) and profile pictures (they need Supabase Storage). **B2.5 (D83)** adds staff sign-in on Supabase for the admin console (the teacher portal's wiring comes with B3), on a session core now shared with the student app. **B2.6a (D84)** adds the admin console's courses, enrolment and join requests on Supabase, with the course contract run unchanged against the local stack. Still to do: B2.6b classes, B2.7 Edge Functions and users, B2.8 dashboard, and profile pictures. The hosted dev project needs the reset-email template pasted in and its redirect URLs set (see `supabase/templates/recovery.html`).

**Done when:** admin acceptance steps 1 to 6 (admin REQUIREMENTS section 25) pass against Supabase; a student's notes persist and stay private; the contract suites pass for both implementations.

### B3 — Summary pipeline, and the teacher portal on real data

- When a class ends, a job is queued; a server-side worker or Edge Function calls the language model (the key stays in Supabase secrets) and writes a draft summary in `in_review`.
- Failures are recorded as failed jobs, with a limit on retries.
- The teacher portal switches to Supabase for the review flow and publishing.
- No note content is exposed to the admin portal.

**Done when:** the acceptance scenario for "after stage B" (admin REQUIREMENTS section 25, steps 1 to 5) runs end to end with real accounts: notes → AI job → draft in review → teacher approves → student reads the summary.

### B4 — Minimum ops

This is the part of A8 the loop cannot do without.

- Admin: a failed-jobs list and Retry (the `retry-ai-job` Edge Function; available only on failed jobs, limited by the maximum-retries value, audited).
- The dashboard's alerts read the real data.
- In-app notifications: the teacher is told when a draft is waiting for review, and the student when their summary is published.

**Done when:** an admin retries a failed job and it runs again; a teacher and a student each get their notification.

### B5 — Launch

**Covers:** student M6 and admin A11, reduced to what a pilot needs.

- Accessibility and responsive pass at 360, 768, 1024 and 1440 px on all three portals.
- Security headers verified on the production URLs; Lighthouse check on the landing page.
- Error reporting wired to `reportError`; Supabase backups on.
- `README.md` and a short runbook: deploying, rotating secrets, restoring a backup, retrying a failed job.
- A pilot with one real class through one full cycle.

**Done when:** the pilot class completes a cycle without developer help, and a new developer can run every app from the README alone.

---

## Post-MVP

Parked by D73. None of it is needed for the core loop. Each item returns when the MVP is live and a real need shows up.

| Item                                                                                          | Why it waits                                                              |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **A7 Resources** (upload, publish, archive, assign) and a student Resources view              | Students have no Resources screen; it is also the largest storage work    |
| **A8, the rest:** counters, summary table, AI jobs table, pipeline view                       | Monitoring only; B4 keeps failed jobs and Retry                           |
| **A9 Analytics and the audit log viewer**                                                     | Audit entries are already written; only the viewer waits                  |
| **A10 Settings and the admin notifications page and bell**                                    | Dashboard alerts cover the urgent cases; sign-up stays as built           |
| **A11 extras:** per-app READMEs, table column visibility                                      | B5 carries the accessibility and responsive pass                          |
| Google sign-in                                                                                | Email and password is enough for a pilot                                  |
| PWA level 3 (D22): offline note sync with conflict handling, push notifications               | Needs the backend and real usage data first                               |
| Full-text search of note bodies (student REQUIREMENTS section 8)                              | Search by title and tag works                                             |
| Real Ask AI answers (the "Preview" label comes off when it ships)                             | Separate from the summary pipeline; needs its own design (open question 1) |
| Teacher extras: analytics, resources, class scheduling by teachers                            | The review flow is the whole teacher MVP                                  |
