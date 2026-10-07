# CoNote Student Portal — Build Milestones

These milestones break the work in [`REQUIREMENTS.md`](./REQUIREMENTS.md) into seven stages (M1 to M6, plus M2.5). Every milestone follows [`ENGINEERING_STANDARDS.md`](./ENGINEERING_STANDARDS.md), and nothing counts as done until its Definition of Done is met. Each stage ends with something that can be opened in a browser and checked. They are a planning aid added during review; they were not part of the original brief.

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

## Restructure — Monorepo (D64)

Done between M5 and M6, before the admin portal starts. No change for students.

- The student portal moved to `apps/student` with its history kept (`git mv`).
- Shared packages: `packages/ui` (tokens, Tailwind theme, UI primitives, `cn`) and `packages/domain` (IDs, roles, statuses).
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

## Optional — Real backend (not scheduled)

Not requested in the brief. It could be inserted after M2 if real accounts are wanted early.

- Supabase project, and the tables from section 12.2 with Row Level Security
- Real email/password and Google sign-in
- Supabase implementations of the Course, Class, Note, Profile and Notification services
- Full-text search of note bodies using Postgres full-text search (REQUIREMENTS section 8)
- PWA level 3 (D22): notes written offline are queued and synced with conflict handling; push notifications for published summaries and class reminders
- Later still: a server function that calls a language model for Ask AI, and the summary-generation pipeline (which belongs with the teacher portal)

Adding this early makes every later milestone somewhat slower, because each screen then needs real data and real rules behind it.
