# CoNote Student Portal — Build Milestones

These milestones break the work in [`REQUIREMENTS.md`](./REQUIREMENTS.md) into six stages. Each stage ends with something that can be opened in a browser and checked. They are a planning aid added during review; they were not part of the original brief.

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

**Done when:** a visitor can "log in" and click through every (empty) portal page at 360 px, 768 px and 1440 px wide. Signing out returns to the landing page. Portal URLs redirect to login when signed out.

---

## M2 — Public pages

**Covers:** FR-LND-1 to FR-LND-6, FR-AUTH-1 to FR-AUTH-6.

- Landing page:
  - header, with a phone menu
  - hero with the dashboard preview
  - six-step How It Works
  - features grid, About, call-to-action band and footer
- Sign in, sign up, forgot password and reset password pages
- zod validation schemas with inline errors
- Loading and disabled states on submit
- Google and Microsoft buttons (mock sign-in)
- Placeholder `/terms` and `/privacy` pages
- Unit tests for the validation schemas

**Done when:** a new visitor can go from the landing page through sign-up to the dashboard, and every form rejects bad input with a clear message.

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
  - draft autosave to `localStorage`
- Read view, with the HTML sanitised by DOMPurify
- Notes page: My Notes tab, course filter, search, sort, row menu (Open, Edit, Delete)
- Delete confirmation
- Optimistic updates with rollback
- Notes wired into the Course Details and Class Notes tabs
- Notice when editing a note on a class whose summary is already published
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
  - context picker
  - suggested prompts
  - Enter to send
  - typing indicator
  - retry on error
  - canned replies
- Summaries tab on the Notes page and on Course Details
- Notifications: four tabs, unread dots, mark as read, mark all read, live unread count in the nav
- Settings: Profile, Account, Notifications, Privacy (JSON export), Help & Support (FAQ, reset demo data)
- Global search in the top bar
- Component tests for the summary state card and the auth guard

**Done when:** every screen in `wireframes/student-portal.jpg` exists and works on demo data. A summary that is not published never shows its content.

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
- Lint, typecheck and tests all passing
- `README.md`: setup, scripts, environment variables, folder guide, and how to switch to Supabase

**Done when:** the app is ready to demo or hand over, and a new developer can run it from the README alone.

---

## Optional — Real backend (not scheduled)

Not requested in the brief. It could be inserted after M2 if real accounts are wanted early.

- Supabase project, and the tables from section 12.2 with Row Level Security
- Real email/password, Google and Microsoft (`azure`) sign-in
- Supabase implementations of the Course, Class, Note, Profile and Notification services
- Later still: a server function that calls a language model for Ask AI, and the summary-generation pipeline (which belongs with the teacher portal)

Adding this early makes every later milestone somewhat slower, because each screen then needs real data and real rules behind it.
