# CoNote

The CoNote monorepo (decision D64). Students write private notes per class. An AI pipeline and teacher review produce summaries, and students see only teacher-approved ones. Each role gets its own app; all apps share one backend and the packages below.

| Folder                                 | What it is                                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/student`                         | The student portal (React + TypeScript + Vite PWA). **Never add teacher or admin screens, routes or links here.**                                   |
| `apps/admin`                           | The admin console (React + TypeScript + Vite web app, routes under `/admin`). Admin screens only. Spec: `docs/admin/`.                              |
| `apps/teacher`                         | The teacher portal (React + TypeScript + Vite web app, routes under `/teacher`). Teacher screens only. Spec: `docs/teacher/`.                       |
| `packages/ui` (`@conote/ui`)           | Shared design system: tokens, Tailwind theme, shadcn-style primitives, `common/` page parts, `forms/`, `toast`, `cn`                                |
| `packages/portal` (`@conote/portal`)   | What the staff portals (admin, teacher) share: sign-in state, role guards, the demo auth service, the three sign-in pages, the frame, error screens |
| `packages/domain` (`@conote/domain`)   | Shared vocabulary: roles and statuses. Every app and the database spell these the same way.                                                         |
| `packages/core` (`@conote/core`)       | Shared logic: `AppError`, `appQuery`, `isSafeRedirect`, `reportError`, `parseEnv`, `assertNever`, `initials`                                        |
| `packages/testing` (`@conote/testing`) | Test-only helpers: common Vitest setup, axe, Playwright axe and CSP checks                                                                          |

Packages must not import app code (`@/…`); ESLint enforces it. Apps import packages by name (`@conote/ui/button`).

## Read before changing code

- `docs/REQUIREMENTS.md`: the student portal's scope, routes, requirement IDs (FR-…, NFR-…), data model, and the decisions log for the whole repository
- `docs/ENGINEERING_STANDARDS.md`: testing, architecture, security and review rules. **These rules are binding.**
- `docs/MILESTONES.md`: what is being built, in what order, and CI and deploy setup
- `docs/admin/REQUIREMENTS.md` and `docs/admin/MILESTONES.md`: the admin console's spec and milestones
- `docs/teacher/REQUIREMENTS.md`: the teacher portal's spec (milestones T1 and T2 are in `docs/MILESTONES.md`)
- `docs/USER_FLOWS.md`: sitemap, user flows and user journeys

## Non-negotiables

1. **TDD for logic.** Write the failing test first, make it pass, then refactor (standards section 2).
2. **Every bug fix starts with a failing test.**
3. **UI never imports a service implementation.** Use `useServices()`. Only each app's `src/app/createServices` touches `services/mock` or `services/supabase`.
4. **User HTML renders only through `SafeHtml`.** `dangerouslySetInnerHTML` is banned everywhere else.
5. **`?redirect=` values go through `isSafeRedirect()`.**
6. **No `any` and no `console.log`.** Report errors with `reportError()`.
7. **Every data view handles loading, empty, error and not-found.**
8. **No new dependency without a stated reason** (standards section 10).
9. **Keep the docs in sync.** New decisions go in REQUIREMENTS section 15.
10. **Comment every statement** (standards section 4.5): what it does and why. Security lines start with `SECURITY:` and name the attack they block. JSON config files are explained in `docs/CONFIG_FILES.md` instead.

## Commands

Run from the repository root. `build`, `size` and `e2e` run in every app; `dev` and `preview` run the student app (`npm run dev:admin` for the console, `npm run dev:teacher` for the teacher portal, or `-w @conote/<app>` for any script in one app).

- `npm run dev`: dev server
- `npm test -- --run --coverage`: unit and component tests with the coverage floor
- `npm run lint`, `npm run format:check`, `npm run typecheck`
- `npm run build`, then `npm run size`
- `npm run e2e`: Playwright against the production build. In this cloud environment, set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

Run all of these before pushing. CI runs the same set plus `npm audit` and gitleaks.

## Gotchas

- Routes live in each app's `src/app/routes.tsx` and `src/lib/routes.ts`. Pages are lazy-loaded, so tests use `findBy…`.
- Sign-out never navigates from the caller. The route guard (`RequireStudent`, or `RequireRole` from `@conote/portal` in the admin and teacher apps) does it, which avoids two competing redirects.
- Sign-in, password recovery, guards, the frame and the error screens of the admin and teacher apps live in `packages/portal` (D77). An app supplies only its words, addresses and accounts (`pages/auth/*`, `app/routes.tsx`, `services/mock/mockAuthService.ts`). Fix a bug there once, in the package. Both apps' `styles/globals.css` have an `@source` line for it, so its classes are generated.
- Radix `Slot` (`asChild`) turns a function `className` into a string. Don't pass `NavLink`'s function className through it; use `SidebarLink`.
- Password fields have a "Show password" toggle. In Playwright, `getByLabel('Password')` also matches it, so pass `{ exact: true }`.
- The service worker registers only in production builds (the plugin's hook is a no-op in `npm run dev` and in Vitest). Test offline behaviour with Playwright (`apps/student/e2e/pwa.spec.ts`).
- Any runtime cache that may hold student data must be named with `RUNTIME_CACHE_PREFIX` from `lib/pwa.ts`, or sign-out won't delete it.
- The shadcn registry is not reachable from every environment. The primitives in `packages/ui/src/components/` follow the shadcn new-york source and can be edited directly. A new primitive imports `cn` from `'../utils'`, never through the `@/` alias, since every app defines `@/` as its own `src/`.
- Tailwind scans only the app's own files plus the `packages/ui/src` folders named by the `@source` lines in `packages/ui/src/styles/theme.css` (`components`, `common`, `forms`, `toast`). A class used anywhere else is not generated; a new folder needs its own `@source` line.
- The teacher app is its own Vercel project with Root Directory `apps/teacher`, using `apps/teacher/vercel.json`.
- Vercel builds the student app from the root `vercel.json` (`buildCommand` and `outputDirectory`). The admin app is its own Vercel project with Root Directory `apps/admin`, using `apps/admin/vercel.json`.
- Admin demo sign-in: `admin@conote.example` / `password1` (also `teacher@` and `student@conote.example`, which the guard turns away). The admin e2e server uses port 4174, the student's 4173.
- An admin password changed through the demo reset flow is kept in local storage (`conote-admin-demo:` keys) and survives sign-out, like server data. Clear the site's storage to get `password1` back.
- Teacher demo sign-in: `teacher@conote.example` / `password1` (also `admin@` and `student@conote.example`, which the guard turns away). The teacher e2e server uses port 4175. The teacher demo has its own seed (`apps/teacher/src/services/mock/seed`), dated from the moment the app opens; its MTH 202 matches the admin demo's, but the three apps' demo data is separate (D74). Teacher edits and publishes are saved under local storage key `conote-teacher-demo:platform` and restored over the seed (D75); clear the site's storage to start again.
- The admin dashboard reads one seeded demo platform (D69). Its health card is all "Operational" unless local storage key `conote-admin-demo:health` says otherwise, for example `{"storage":"degraded"}`. Admin page tests pass their own `platform` records to `renderWithRouter`.
- Admin demo changes to users, courses, classes and enrolments (invitations, status changes, edits, archiving) are saved under local storage key `conote-admin-demo:platform` and restored over the seed (D70, D71, D72). Classes are saved with their summaries and AI jobs. Clear the site's storage to start from the seed again.
- Test helpers may import demo services; tests themselves import them through `src/test/` (the import-boundary rule).
- App icons and iPhone launch images: `npm run icons -w @conote/student` (needs `PW_CHROMIUM_PATH` here).

## Conventions

- **Branch and commit:** Conventional Commits (`feat(notes): …`).
- **Pull requests:** one feature slice each, with the Definition of Done checklist filled in.
- **Data source:** `VITE_DATA_SOURCE=mock` (the default) runs everything on seeded demo data. See REQUIREMENTS section 5.2.
