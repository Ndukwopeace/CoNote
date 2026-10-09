# CoNote Admin Portal — Milestones

The admin portal (`apps/admin`) is built in milestones, one pull request each, on demo data first. The requirements are in [`REQUIREMENTS.md`](./REQUIREMENTS.md); the engineering rules in [`../ENGINEERING_STANDARDS.md`](../ENGINEERING_STANDARDS.md) apply in full.

| # | Milestone | Status |
|---|---|---|
| A1 | App setup | Done |
| A2 | Sign-in polish: forgot and reset password | Done |
| A3 | Dashboard: statistics, activity chart, system health, alerts | Done |
| A4 | Users: tabs, search, filters, details, invite, status changes | Done |
| A5 | Courses: create, edit, archive, teacher assignment, enrolment (including bulk CSV) | Done |
| A6 | Classes: create, edit, archive, details | Next |
| A7 | Resources: upload, publish, archive, assign | |
| A8 | AI & Summaries: counters, tables, failed jobs, retry, pipeline details | |
| A9 | Analytics and audit logs | |
| A10 | Settings and admin notifications | |
| A11 | Finishing: accessibility and layout checks at 360 / 768 / 1024 / 1440, README | |
| B | Shared backend stage (all portals): schema, RLS, Edge Functions, audit triggers, storage, AI pipeline, notifications; each portal then switches to Supabase | |

---

## A1 — App setup

**Delivered**

- `apps/admin` (`@conote/admin`): React 19, TypeScript strict, Vite 8, Tailwind 4 with the shared CoNote theme, React Router 8 with lazy routes, TanStack Query. No PWA: the console is a desktop-first web app.
- Shared code instead of copies (D67): `@conote/core` (errors, safe redirects, environment, error reporting, initials), `@conote/ui` (primitives plus `common/` page parts, `forms/` fields and `SidebarLink`), `@conote/testing` (test setup, axe and Playwright helpers).
- Routes from section 7 under `/admin`, each a placeholder page; `/` and `/admin` go to the dashboard; unknown addresses show "Page not found".
- Demo sign-in at `/admin/login`: one demo account per role, password `password1` (demo mode only). No sign-up.
- The admin-only guard: signed-out visitors go to sign-in with the page remembered (checked by `isSafeRedirect`); students and teachers see "This console is for administrators" and can sign out.
- The frame: sidebar on desktop, icon rail with tooltips on tablets, menu button and sliding panel on phones; account menu with Settings and Sign out.
- Sign-out clears the query cache and every `conote-admin:` key, so the next person at the computer sees nothing.
- Security: the student app's headers and CSP, plus `X-Robots-Tag: noindex, nofollow` and a `robots` meta tag, so the console isn't listed by search engines.
- CI: lint, type check, unit tests, build, bundle budget and browser tests now cover both apps.

**Done when**

- Every route opens for an admin and is refused for other roles (unit and browser tests).
- Sign-in returns to the requested page and ignores unsafe return addresses.
- Navigation works on desktop and phone (Playwright, both screen profiles); axe finds no problems; no CSP violations.
- Lint, format, type check, unit tests with the coverage floor, build, bundle budget and browser tests pass for every app.

**Deploying the admin app (one-time, by the repository owner)**

In Vercel, add a second project from the same GitHub repository with **Root Directory** set to `apps/admin` and the environment variable `VITE_DATA_SOURCE=mock`. Vercel reads `apps/admin/vercel.json` for the install and build commands (both run from the repository root, so the shared build tools are installed), the rewrites and the security headers. The student project stays as it is.

---

## A2 — Sign-in polish: forgot and reset password

**Delivered**

- "Forgot password?" on sign-in, and the forgot-password and reset-password pages (REQUIREMENTS section 9).
- `AuthService` gains `requestPasswordReset`, `checkResetLink` and `resetPassword`, with contract tests every implementation must pass:
  - the same answer for any well-formed email
  - links that work once
  - newer links replace older ones
  - weak passwords refused without spending the link
- Admin passwords need 12+ characters with a letter and a number (D68).
- Shared with the student app (packages/core): the new-password rules (`createNewPasswordSchema`) and the sign-in notices (`createNavigationNotices`).
- Demo: changed passwords and the current reset link are kept in local storage under `conote-admin-demo:`, standing in for the server, so sign-out keeps them.

**Done when**

- The whole recovery flow works in the browser on desktop and phone: request, demo link, new password, confirmation, sign-in with the new password, the old one refused, and the used link refused (Playwright).
- Unit, contract and page tests pass; axe finds no problems; no CSP violations.

---

## A3 — Dashboard

**Delivered**

- The dashboard (REQUIREMENTS section 10):
  - the greeting by time of day
  - six counts linking to their lists
  - one activity chart with a 7 / 30 / 90-day range, a series picker, a hover and keyboard crosshair, and a table view
  - alerts linking to the screen that fixes each problem
  - system health with "Unknown" for anything the check doesn't report
- New services, each with a contract suite:
  - `AnalyticsService` (`getOverview`, `getActivitySeries`)
  - `AlertService` (`listAlerts`)
  - `HealthService` (`getHealth`)
- The demo platform (D69): users, courses, classes, summaries, AI jobs, 90 days of activity and a few problems. It is built relative to the current time from a fixed pseudo-random sequence. Its first four courses and teachers match the student portal's demo.
- Moved to shared packages: `StatCard` and the new `ErrorPanel` (`@conote/ui/common`), and `appQuery` (`@conote/core`).
- The chart is plain SVG with HTML labels. No chart library.

**Done when**

- Counts, series and alerts are computed from records, proven by contract tests on hand-built data.
- Every part shows loading, empty and error states on its own (page tests). The chart works by pointer and keyboard (component tests).
- In the browser, on desktop and phone:
  - the counts and alerts show
  - an alert opens its screen
  - the range, series and table view work
  - the health states show in words
  - axe finds no problems
  - there are no CSP violations

---

## A4 — Users

**Delivered**

- The Users page (REQUIREMENTS section 11):
  - Students, Teachers and Admins tabs, with each tab's columns
  - search, status, department and course filters, sorting and 20-per-page lists, all kept in the address
  - a card per person on phones
  - empty, no-match and error states
- User details: profile, courses, status history (from the audit log), and the actions.
- Actions, from the row menu and the details page:
  - edit
  - activate, deactivate and suspend (asking first before blocking)
  - send a password reset link
  - invite user
- `UserService` with a contract suite. Every change writes an audit entry.
- The demo saves users, enrolments and the audit log in local storage (`conote-admin-demo:platform`), so changes survive a reload.
- Sign-in refuses accounts that are not active.
- Moved to `@conote/ui`: `ConfirmDialog`, `EmptyState` and the toasts. Added `NativeSelect`.

**Done when**

- The service rules are proven by contract tests, the forms' and filters' rules by unit tests, and both pages by page tests (states, dialogs, address).
- In the browser, on desktop and phone:
  - filters survive a reload
  - an invitation is listed as Invited after a reload
  - a suspended account can't sign in
  - phones show cards with no sideways scrolling
  - axe finds no problems
  - there are no CSP violations

---

## A5 — Courses

**Delivered**

- The Courses page (REQUIREMENTS section 12):
  - table with code, title, teacher, students, classes and status, 20 to a page
  - search, status, department and teacher filters (including `?teacher=none`) and an archived toggle, all kept in the address
  - create dialog, and row actions: view, edit, archive, restore
  - empty, no-match, archived-empty and error states
- Course details with four tabs:
  - Overview: description, status, teacher and the counts
  - Students: search, enrol, remove (asking first)
  - Classes: sessions with their summary stage
  - Resources: files and links attached to the course
- Teacher: assign, change and remove (asking first), from the course and, for teachers, from the Users page.
- Bulk enrolment: paste text or choose a `.csv`, preview (will be enrolled, already enrolled, not matched with reasons), then enrol only the valid rows.
- `CourseService` with a contract suite. Every change writes an audit entry. Archived courses refuse changes.
- Shared table (`DataTable`) and search box (`SearchField`) used by Users and Courses; `Textarea` added to `@conote/ui`.
- The demo saves courses and resources with the users, enrolments and audit log.

**Done when**

- The service rules are proven by contract tests, the form, filter and identifier rules by unit tests, and both pages by page tests (states, dialogs, address, preview).
- In the browser, on desktop and phone:
  - the list opens filtered to courses without a teacher, and a new course survives a reload
  - a teacher is assigned and removed, and students are enrolled from a preview
  - an archived course leaves the list, refuses changes, and returns when restored
  - axe finds no problems
  - there are no CSP violations
