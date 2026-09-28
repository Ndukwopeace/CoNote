# CoNote — Student Portal

A React + TypeScript + Vite web app for the **student side only** of CoNote. Students write private notes per class. A separate AI pipeline and teacher review produce summaries, and students see only teacher-approved ones. Never add teacher or admin screens, routes or links.

## Read before changing code

- `docs/REQUIREMENTS.md`: scope, routes, requirement IDs (FR-…, NFR-…), data model, decisions log
- `docs/ENGINEERING_STANDARDS.md`: testing, architecture, security and review rules. **These rules are binding.**
- `docs/MILESTONES.md`: what is being built, in what order, and CI and deploy setup
- `docs/USER_FLOWS.md`: sitemap, user flows and user journeys

## Non-negotiables

1. **TDD for logic.** Write the failing test first, make it pass, then refactor (standards section 2).
2. **Every bug fix starts with a failing test.**
3. **UI never imports a service implementation.** Use `useServices()`. Only `app/createServices` touches `services/mock` or `services/supabase`.
4. **User HTML renders only through `SafeHtml`.** `dangerouslySetInnerHTML` is banned everywhere else.
5. **`?redirect=` values go through `isSafeRedirect()`.**
6. **No `any` and no `console.log`.** Report errors with `reportError()`.
7. **Every data view handles loading, empty, error and not-found.**
8. **No new dependency without a stated reason** (standards section 10).
9. **Keep the docs in sync.** New decisions go in REQUIREMENTS section 15.
10. **Comment every statement** (standards section 4.5): what it does and why. Security lines start with `SECURITY:` and name the attack they block. JSON config files are explained in `docs/CONFIG_FILES.md` instead.

## Commands

- `npm run dev`: dev server
- `npm test -- --run --coverage`: unit and component tests with the coverage floor
- `npm run lint`, `npm run format:check`, `npm run typecheck`
- `npm run build`, then `npm run size`
- `npm run e2e`: Playwright against the production build. In this cloud environment, set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

Run all of these before pushing. CI runs the same set plus `npm audit` and gitleaks.

## Gotchas

- Routes live in `src/app/routes.tsx` and `src/lib/routes.ts`. Pages are lazy-loaded, so tests use `findBy…`.
- Sign-out never navigates from the caller. `RequireStudent` reads `exitTo` from the auth state and does it, which avoids two competing redirects.
- Radix `Slot` (`asChild`) turns a function `className` into a string. Don't pass `NavLink`'s function className through it; use `SidebarLink`.
- Password fields have a "Show password" toggle. In Playwright, `getByLabel('Password')` also matches it, so pass `{ exact: true }`.
- The shadcn registry is not reachable from every environment. The primitives in `src/components/ui/` follow the shadcn new-york source and can be edited directly.

## Conventions

- **Branch and commit:** Conventional Commits (`feat(notes): …`).
- **Pull requests:** one feature slice each, with the Definition of Done checklist filled in.
- **Data source:** `VITE_DATA_SOURCE=mock` (the default) runs everything on seeded demo data. See REQUIREMENTS section 5.2.
