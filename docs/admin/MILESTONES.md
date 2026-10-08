# CoNote Admin Portal — Milestones

The admin portal (`apps/admin`) is built in milestones, one pull request each, on demo data first. The requirements are in [`REQUIREMENTS.md`](./REQUIREMENTS.md); the engineering rules in [`../ENGINEERING_STANDARDS.md`](../ENGINEERING_STANDARDS.md) apply in full.

| # | Milestone | Status |
|---|---|---|
| A1 | App setup | Done |
| A2 | Sign-in polish: forgot and reset password | Done |
| A3 | Dashboard: statistics, activity chart, system health, alerts | Done |
| A4 | Users: tabs, search, filters, details, invite, status changes | Next |
| A5 | Courses: create, edit, archive, teacher assignment, enrolment (including bulk CSV) | |
| A6 | Classes: create, edit, archive, details | |
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
