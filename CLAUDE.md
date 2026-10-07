# CoNote

The CoNote monorepo (decision D64). Students write private notes per class. An AI pipeline and teacher review produce summaries, and students see only teacher-approved ones. Each role gets its own app; all apps share one backend and the packages below.

| Folder                               | What it is                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `apps/student`                       | The student portal (React + TypeScript + Vite PWA). **Never add teacher or admin screens, routes or links here.** |
| `apps/admin`, `apps/teacher`         | Not built yet. Each role's screens go in its own app.                                                             |
| `packages/ui` (`@conote/ui`)         | Shared design system: tokens, Tailwind theme, shadcn-style primitives, `cn`                                       |
| `packages/domain` (`@conote/domain`) | Shared vocabulary: IDs, roles, statuses. Every app and the database spell these the same way.                     |

Packages must not import app code (`@/…`); ESLint enforces it. Apps import packages by name (`@conote/ui/button`).

## Read before changing code

- `docs/REQUIREMENTS.md`: the student portal's scope, routes, requirement IDs (FR-…, NFR-…), data model, and the decisions log for the whole repository
- `docs/ENGINEERING_STANDARDS.md`: testing, architecture, security and review rules. **These rules are binding.**
- `docs/MILESTONES.md`: what is being built, in what order, and CI and deploy setup
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

Run from the repository root. App-specific commands (`dev`, `build`, `size`, `e2e`) run the student app; use `-w @conote/<app>` for another.

- `npm run dev`: dev server
- `npm test -- --run --coverage`: unit and component tests with the coverage floor
- `npm run lint`, `npm run format:check`, `npm run typecheck`
- `npm run build`, then `npm run size`
- `npm run e2e`: Playwright against the production build. In this cloud environment, set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

Run all of these before pushing. CI runs the same set plus `npm audit` and gitleaks.

## Gotchas

- Routes live in `apps/student/src/app/routes.tsx` and `apps/student/src/lib/routes.ts`. Pages are lazy-loaded, so tests use `findBy…`.
- Sign-out never navigates from the caller. `RequireStudent` reads `exitTo` from the auth state and does it, which avoids two competing redirects.
- Radix `Slot` (`asChild`) turns a function `className` into a string. Don't pass `NavLink`'s function className through it; use `SidebarLink`.
- Password fields have a "Show password" toggle. In Playwright, `getByLabel('Password')` also matches it, so pass `{ exact: true }`.
- The service worker registers only in production builds (the plugin's hook is a no-op in `npm run dev` and in Vitest). Test offline behaviour with Playwright (`apps/student/e2e/pwa.spec.ts`).
- Any runtime cache that may hold student data must be named with `RUNTIME_CACHE_PREFIX` from `lib/pwa.ts`, or sign-out won't delete it.
- The shadcn registry is not reachable from every environment. The primitives in `packages/ui/src/components/` follow the shadcn new-york source and can be edited directly. A new primitive imports `cn` from `'../utils'`, never through the `@/` alias, since every app defines `@/` as its own `src/`.
- Tailwind scans only the app's own files plus `packages/ui/src/components` (the `@source` line in `packages/ui/src/styles/theme.css`). A class used anywhere else is not generated.
- Vercel builds the student app from the root `vercel.json` (`buildCommand` and `outputDirectory`). When another app is deployed, it gets its own Vercel project whose Root Directory is that app's folder.
- App icons and iPhone launch images: `npm run icons -w @conote/student` (needs `PW_CHROMIUM_PATH` here).

## Conventions

- **Branch and commit:** Conventional Commits (`feat(notes): …`).
- **Pull requests:** one feature slice each, with the Definition of Done checklist filled in.
- **Data source:** `VITE_DATA_SOURCE=mock` (the default) runs everything on seeded demo data. See REQUIREMENTS section 5.2.
