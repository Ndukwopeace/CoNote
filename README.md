# CoNote

Students write private notes for each class; CoNote AI turns the class's combined notes into a
draft summary; a teacher approves it; students read the approved version.

This repository is a monorepo (npm workspaces). Each role gets its own app, and the apps share
one backend and a set of packages:

| Folder             | Package           | What it is                                                |
| ------------------ | ----------------- | --------------------------------------------------------- |
| `apps/student`     | `@conote/student` | The student portal: an installable web app (built, M1–M5) |
| `apps/admin`       | `@conote/admin`   | The admin console (in progress, A1 done)                  |
| `packages/ui`      | `@conote/ui`      | Design tokens, Tailwind theme, UI primitives, form fields |
| `packages/domain`  | `@conote/domain`  | Shared roles and statuses                                 |
| `packages/core`    | `@conote/core`    | Errors, safe redirects, environment checks, reporting     |
| `packages/testing` | `@conote/testing` | Test-only helpers shared by every app                     |

The teacher portal will be added as `apps/teacher`. Progress: [`docs/MILESTONES.md`](docs/MILESTONES.md)
(student) and [`docs/admin/MILESTONES.md`](docs/admin/MILESTONES.md) (admin).

## Quick start

Requires **Node 22.22 or newer** (see `.nvmrc`).

```bash
npm ci                                                 # installs every app and package
cp apps/student/.env.example apps/student/.env.local   # optional: the defaults use demo data
npm run dev                                            # the student app, http://localhost:5173
npm run dev:admin                                      # the admin console, http://localhost:5174/admin
```

**Student app:** sign in with **any valid email and any password**, or either OAuth button. You
are signed in as the demo student. Demo data lives in your browser's storage.

**Admin console:** sign in as `admin@conote.example` with the password `password1`. The demo
teacher and student accounts (`teacher@` and `student@conote.example`, same password) are turned
away, which shows the admin-only guard.

## Scripts

Run from the repository root. Lint, format, type check, tests, `build`, `size` and `e2e` cover
every app and package; `dev` and `preview` run the student app (`npm run dev:admin` for the
console, or add `-w @conote/<app>` to run any script in one app).

| Command                        | What it does                                                |
| ------------------------------ | ----------------------------------------------------------- |
| `npm run dev`                  | Start the dev server                                        |
| `npm test`                     | Unit and component tests in watch mode                      |
| `npm test -- --run --coverage` | Run tests once with the coverage floor (as CI does)         |
| `npm run e2e`                  | Build, serve with production headers, run Playwright        |
| `npm run lint`                 | ESLint, zero warnings allowed                               |
| `npm run format`               | Format everything with Prettier                             |
| `npm run typecheck`            | TypeScript project build, no output                         |
| `npm run build`                | Production build of every app into `apps/<app>/dist/`       |
| `npm run size`                 | Check the initial JavaScript against the 250 KB gzip budget |

A pre-commit hook (Husky + lint-staged) formats, lints and runs related tests on staged files.

**Playwright on a machine with its own Chromium:** set `PW_CHROMIUM_PATH` to the browser
executable to skip Playwright's download.

## Environment variables

| Variable                 | Default | Notes                                                        |
| ------------------------ | ------- | ------------------------------------------------------------ |
| `VITE_DATA_SOURCE`       | `mock`  | `mock` (demo data) or `supabase` (not built yet; fails fast) |
| `VITE_SUPABASE_URL`      |         | Only for `supabase`. Must be `https`.                        |
| `VITE_SUPABASE_ANON_KEY` |         | Only for `supabase`. Never put a service-role key here.      |

Variables are validated at startup (`apps/student/src/lib/env.ts`). Vite bakes them in at build time, so a
change needs a rebuild or redeploy.

## Folder guide

Inside `apps/student/`:

```
src/
  app/          router table, providers, service factory (the only file that picks mock vs Supabase)
  pages/        one folder per route; each page is lazy-loaded
  layouts/      public, auth and portal shells; sidebar, bottom bar, top bar
  components/
    common/     shared app components (SafeHtml, PlaceholderPage, RouteErrorBoundary, ...)
  features/auth AuthProvider, useAuth, route guards
  services/     service interfaces, ServicesProvider, contract tests
    mock/       demo implementation
    supabase/   placeholder until the backend stage
  lib/          pure helpers: routes, env, errors, sanitising, safe redirects, storage
  types/        domain types
  test/         test setup, factories, render helpers, axe helper
e2e/            Playwright tests
public/         icons, iPhone launch images, favicon
scripts/        icon and launch-image generator
```

The shared UI primitives live in `packages/ui/src/components/`, and the docs in `docs/` at the
root.

Import rules between these folders are enforced by ESLint
([`docs/ENGINEERING_STANDARDS.md`](docs/ENGINEERING_STANDARDS.md) section 3.1).

## Switching to Supabase (backend stage)

1. Implement each interface in `apps/student/src/services/types.ts` under
   `apps/student/src/services/supabase/`.
2. Run the existing contract suites (`apps/student/src/services/contracts/`) against it.
3. Return the new implementation from `createSupabaseServices()`.
4. Set `VITE_DATA_SOURCE=supabase` plus the two Supabase variables.

No page or hook changes should be needed. If one is, the interface was wrong.

## Deployment

Vercel, configured by the root `vercel.json`: it builds the student app
(`npm run build -w @conote/student`, output in `apps/student/dist`), adds a rewrite so client-side
routes survive a refresh, and sends the security headers from the engineering standards. `npm run e2e` serves the
build with the same headers, so a policy that breaks the app fails locally and in CI first.

## Documentation

- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md): scope, routes, requirement IDs, data model, decisions log
- [`docs/MILESTONES.md`](docs/MILESTONES.md): build order, CI and deployment
- [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md): sitemap, user flows, user journeys
- [`docs/ENGINEERING_STANDARDS.md`](docs/ENGINEERING_STANDARDS.md): testing, architecture, security, review
