# CoNote — Engineering Standards

**Status:** Agreed v1.0
**Applies to:** all code in this repository, from M1 onward: every app under `apps/` and every shared package under `packages/` (D64). Paths such as `src/lib` are relative to each app's folder, for example `apps/student/src/lib`.
**Related:** [`REQUIREMENTS.md`](./REQUIREMENTS.md), [`MILESTONES.md`](./MILESTONES.md), [`USER_FLOWS.md`](./USER_FLOWS.md)

These rules are meant to be checked, not admired. Wherever a tool can enforce a rule, it does, in the pre-commit hook or in CI (section 14). The rest is checked in code review against the Definition of Done.

---

## 1. Definition of Done

A change is done only when every applicable box is ticked. The pull request template repeats this list.

- [ ] Tests were written before the code they cover (section 2) and pass
- [ ] Coverage thresholds still met
- [ ] Lint, format and type check are clean. No new `eslint-disable` without a comment giving the reason.
- [ ] Loading, empty, error and not-found states handled for every new data view (REQUIREMENTS section 11)
- [ ] Keyboard-only use works; axe checks pass; every control has a label
- [ ] Checked at 360 px and 1440 px wide in the Vercel preview
- [ ] No new security findings (section 6): user HTML goes through `SafeHtml`, inputs are validated, no secrets
- [ ] Every new dependency has a reason in the PR description (section 10)
- [ ] Every statement commented; security lines start with `SECURITY:` and say what they block (section 4.5)
- [ ] Docs updated if behaviour, routes or decisions changed. New decisions go in the decisions log (REQUIREMENTS section 15).
- [ ] CI green on the pull request

---

## 2. Testing

### 2.1 The TDD loop

For anything with logic, the order is fixed:

1. **Red.** Write a test for one behaviour. Run it and watch it fail for the expected reason.
2. **Green.** Write the least code that makes it pass.
3. **Refactor.** Clean up with the test still green.
4. Commit. Repeat for the next behaviour.

**TDD is required for:**

- services, both the mock and (later) the Supabase implementations
- query and mutation hooks
- zod schemas (forms, environment, service responses)
- helpers in `lib/`, such as class status from start and end times, relative dates, and `isSafeRedirect`
- the auth provider, route guard and sign-out cleanup
- the note draft store
- any component with conditional behaviour, such as the summary state card, the note form and the context picker

**Not TDD:** pure layout and styling. These are covered by axe checks, page-level tests that assert content is present, and a visual check in the Vercel preview.

### 2.2 Every bug fix starts with a failing test

The test reproduces the bug. It lands in the same pull request as the fix.

### 2.3 Test types

| Type | Tool | Scope | Share |
|---|---|---|---|
| Unit | Vitest | Functions, schemas, services, hooks | Most tests |
| Component / page | Vitest + Testing Library + `user-event` + `vitest-axe` | A component or whole page rendered with fake services | Many |
| Contract | Vitest | One shared suite per service interface, run against every implementation | One per interface |
| End-to-end | Playwright + `@axe-core/playwright` | Critical flows in a real browser against the mock build | A handful |

**End-to-end flows** (from `USER_FLOWS.md`):

- F2 sign in and redirect
- F4 write a note
- F5 delete a note
- F6 open a published summary, and an unpublished one
- F10 sign out

Each is added in the milestone that builds the flow.

### 2.4 How tests are written

- **Test behaviour through the interface a user or caller sees.** Query by role and label (`getByRole('button', { name: 'Save Note' })`). Do not query by CSS class or test ID unless nothing else works, and do not assert on internal state.
- **One behaviour per test.** The test name states it: `it('shows the reviewing message when the summary is in review')`.
- **Arrange / Act / Assert,** separated by blank lines.
- **Test data comes from factories** in `src/test/factories.ts`, such as `makeNote()`, `makeCourse()` and `makeSummary()`, with overrides. No copy-pasted object literals.
- **Fake services are injected** through `ServicesProvider` (section 3). Tests never mock module imports of services.
- **Time is controlled** with `vi.useFakeTimers()` and a fixed system time. No test depends on the real clock.
- **No real network** in unit or component tests.
- **Tests sit next to the code:** `NoteCard.tsx` → `NoteCard.test.tsx`. End-to-end tests live in `e2e/`.

### 2.5 Contract tests

Each service interface has one suite, for example `noteService.contract.ts`. It exports a function that takes a factory for the implementation under test.

- The mock implementation runs it from M1.
- The Supabase implementation runs the same suite against a local Supabase instance in the backend stage.

If both pass the same suite, swapping the data source cannot change app behaviour. This is the check that makes "Supabase-ready" provable.

### 2.6 Coverage

- **Enforced in CI:** 80% lines and 80% branches for `src/services`, `src/hooks`, `src/lib` and `src/features` in every app (the root `vitest.config.ts`).
- **Excluded:** the shared packages (`packages/ui` holds shadcn-style primitives, `packages/domain` holds types), type-only files and seed data.
- Coverage is a floor that catches untested areas. It is not the goal. A test that runs code without asserting on it does not count, and reviewers reject it.

---

## 3. Architecture and design

### 3.1 Layers and import rules

```
pages ──► features, layouts, components, hooks, lib, types
hooks ──► services (interfaces only, via useServices), lib, types
components ──► other components, lib, types            (no hooks that fetch data, no services)
services/mock, services/supabase ──► services (interfaces), lib, types
app/createServices ──► services/mock, services/supabase (the only file allowed to)
lib ──► types only
any app folder ──► @conote/ui, @conote/domain (shared packages)
packages/* ──► other packages and libraries only (never an app's "@/" code)
```

These rules are enforced by ESLint (`no-restricted-imports` or `eslint-plugin-boundaries`). An import that breaks them fails lint. The rules are written once in the root `eslint.config.js` and apply to every app under `apps/`.

**Shared packages (D64).** Code that two apps would otherwise copy goes in a package: design tokens and UI primitives in `packages/ui`, the shared vocabulary (IDs, roles, statuses) in `packages/domain`. A package never imports app code. App-specific view types stay in the app.

### 3.2 Patterns and where they apply

| Pattern | Where | Why |
|---|---|---|
| **Factory** | `createServices(config)` returns the mock or Supabase set. Test data factories. | One place decides the data source; tests build data consistently |
| **Repository** | One interface per domain area: `NoteService`, `CourseService`, … | Pages and hooks depend on what data they need, not where it lives |
| **Adapter / Mapper** | `services/supabase/mappers.ts` turns rows (`student_id`) into domain types (`studentId`) and back | Database naming never leaks into the UI |
| **Dependency injection** | `ServicesProvider` context plus a `useServices()` hook | Tests and data-source switching need no import mocking |
| **Strategy** | `AiService`: canned replies now, model-backed later | Swap behaviour without touching the chat UI |
| **Container / presentational** | Pages (containers) call hooks and pass props; components render props | Components are easy to test, reuse and review |
| **Query key factory** | `hooks/queryKeys.ts` defines every TanStack Query key | Invalidation after a save cannot drift out of sync |

**YAGNI:** no new abstraction (base class, generic wrapper, extra layer) until there is a second real use. The patterns above already have two uses: mock and Supabase, or production and tests.

### 3.3 Principles in practice

- **Single responsibility.** A component either fetches data or renders it. A hook wraps one query or mutation. A service method does one operation.
- **Dependency inversion.** UI code depends on interfaces in `services/types.ts`, never on `services/mock` or `services/supabase`.
- **Pure core, thin edges.** Business rules live in pure functions in `lib/`, such as `getClassStatus(session, now)`, `summaryStateMessage(status)` and `isSafeRedirect(path)`. Hooks and components call them.
- **Explicit states.** A data view renders exactly one of: loading, error, empty, content. No overlapping flags such as `isLoading && !data && !error`.

---

## 4. TypeScript and code style

### 4.1 Compiler

`strict: true`, plus:

- `noUncheckedIndexedAccess`
- `noImplicitOverride`
- `noFallthroughCasesInSwitch`
- `exactOptionalPropertyTypes`
- `noUnusedLocals`, `noUnusedParameters`

### 4.2 Types

- No `any`. For truly unknown data, use `unknown` and narrow it with zod.
- **Discriminated unions for states,** with exhaustive switches ending in `assertNever(x)`. Adding a new `summaryStatus` then fails the build until every screen handles it.
- **Domain types live in `src/types/`** and are the only shape the UI sees. Identifiers, roles and statuses come from `@conote/domain`, so every app spells them the same way.
- **No type assertions (`as`)** except in tests and in mappers right after zod has validated the data.

### 4.3 Naming

| Thing | Convention | Example |
|---|---|---|
| Components | PascalCase file and export | `NoteCard.tsx` |
| Hooks | `use` + camelCase | `useNotes.ts` |
| Other files | camelCase | `isSafeRedirect.ts` |
| Constants | UPPER_SNAKE_CASE | `MAX_TAGS` |
| Booleans | `is` / `has` / `can` prefix | `isPublished` |
| Event props | `on` + event | `onSave` |
| Handlers | `handle` + event | `handleSave` |

- Names describe intent. No abbreviations beyond common ones (`id`, `url`).
- Named exports only. A default export is allowed only where a tool requires it.

### 4.4 Size and shape

- **Components:** about 250 lines at most. **Functions:** about 40 lines. Nesting at most 3 levels deep. Past these limits, split.
- **No magic strings or numbers.** Routes live in `lib/routes.ts`, limits in `lib/constants.ts`, query keys in `hooks/queryKeys.ts`.
- **Comments follow section 4.5.** Delete commented-out code; git keeps it.
- **Formatting belongs to Prettier.** Nobody argues about it in review.

### 4.5 Comments

Every file is written to be read by someone learning the codebase. Comments are required, not optional.

- **File header.** Every source and config file starts with a short comment saying what the file is for and where it fits.
- **Every meaningful statement gets a comment.** That covers:
  - each import line
  - each declaration, condition, call and return
  - each type field
  - each JSX element that does something
  - each config option

  Only closing brackets, blank lines and pure formatting go without one.
- **What and why.** A comment says what the line does *and* why it is there. "Sets x to 5" is not enough; "5 retries because the mock API fails 1 time in 10" is.
- **`SECURITY:` comments.** Every line that protects something starts its comment with `SECURITY:` and says:
  - which attack or leak it blocks (for example XSS, open redirect, clickjacking, data left on a shared computer)
  - what would happen without it
- **Tests are commented too.** Each test says what behaviour it proves and why that behaviour matters. Each Arrange, Act and Assert step is explained.
- **Comments must stay true.** A change to a line updates its comment in the same commit. A stale comment is a bug, and reviewers reject it.
- **Files that cannot hold comments** (every `package.json`, `vercel.json`, `.size-limit.json`, `.prettierrc.json`, `components.json`, `.nvmrc`) are explained line by line in [`CONFIG_FILES.md`](./CONFIG_FILES.md). Changing one of those files means updating that document in the same PR.

### 4.6 React

- Function components and hooks only.
- **Server data lives in TanStack Query.** It is never copied into `useState`.
- **Derive, don't store.** Anything computable from props or query data is computed during render.
- **`useEffect` is for syncing with outside systems only,** such as `localStorage` or `document.title`. It is never used for data fetching or for deriving state.
- **Forms use react-hook-form + zod.** The zod schema is the single source of the validation rules.
- **Keys are stable IDs,** never array indexes.

---

## 5. Error handling and logging

- **Services throw one error type:** `AppError`, with `kind: 'network' | 'unauthorized' | 'forbidden' | 'not_found' | 'validation' | 'conflict' | 'unknown'` and a safe `message`. Raw Supabase or fetch errors never reach components.
- **The UI maps `kind` to wording** in one place (`lib/errorMessages.ts`). Every message says what happened and what to do next ("Couldn't save your note. Check your connection and try again.").
- **Error boundaries:**
  - one at the root
  - one per portal route, so a crash in one page leaves the navigation working
- **One reporting function:** `reportError(error, context)`. In v1 it logs to the console in development and does nothing in production. It can later send to an error tracker (for example Sentry) without changing call sites.
- **No `console.log` in committed code.** Lint blocks it. Use `reportError`.
- **Never log note content, emails or tokens,** in development or production.

---

## 6. Security

**Baseline:** OWASP ASVS Level 1 for the parts that apply to a browser app. The rules below are the concrete ones.

### 6.1 Untrusted content (XSS)

- **Note HTML is rendered only through `<SafeHtml html={...} />`,** which runs DOMPurify with an allow-list:
  - tags: `p`, `br`, `strong`, `em`, `u`, `h2`, `h3`, `ul`, `ol`, `li`, `a`, `blockquote`, `code`, `pre`
  - attributes: `href` only, and only `http:`, `https:` and `mailto:` URLs
  - links get `rel="noopener noreferrer"` and `target="_blank"`
- **`dangerouslySetInnerHTML` is banned by ESLint** everywhere except inside `SafeHtml`.
- **Sanitise on save and on render.** Saving keeps stored data clean. Rendering protects against data that arrived some other way.
- **Summaries and AI replies render as plain text or structured fields,** never as HTML.

### 6.2 Redirects and URLs

- **`?redirect=` goes through `isSafeRedirect()`,** which accepts only same-origin relative paths:
  - starts with a single `/`
  - does not start with `//` or `/\`
  - resolves to the app's own origin with `new URL(path, origin)`
  - anything else falls back to `/dashboard`
- It has unit tests for each attack shape: `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:alert(1)`, encoded variants.
- **User-supplied links** in notes are limited to `http`, `https` and `mailto` (6.1).

### 6.3 Validation at every boundary

- **Forms:** zod schemas (REQUIREMENTS FR-AUTH-3, FR-NTE-3, FR-NTE-4).
- **Environment:** `lib/env.ts` parses `import.meta.env` with zod at startup and fails fast with a clear message.
- **Service responses:** the Supabase adapter parses every response with zod before mapping it. The mock adapter does the same in tests.
- **Avatar upload:** check type (JPEG or PNG), check size (at most 2 MB), and re-encode through a canvas before upload, which strips metadata. The server repeats the checks in the backend stage.

### 6.4 Authentication and sessions

- **OAuth uses the PKCE flow** (the Supabase default for single-page apps).
- **Route guards are for user experience only.** Real access control is Row Level Security in the database (REQUIREMENTS section 12.2). No UI code assumes that hiding something protects it.
- **Sign-out clears everything:**
  - session and query cache
  - drafts and AI conversation
  - every `conote:`-prefixed `localStorage` key except mock demo data (NFR-4)
  - the persisted query cache in IndexedDB and every runtime service-worker cache (from M2.5; the precached app shell holds no student data and stays)
- **Nothing sensitive in `localStorage`** except the Supabase session, which the Supabase SDK manages.
- **Brute-force and rate limits** are enforced server-side by Supabase Auth. The UI does not pretend to enforce them.

### 6.5 Secrets and configuration

- `.env*` files are git-ignored. Only `.env.example` is committed, with placeholder values.
- **The only credential allowed in the browser is the Supabase anon key.** A service-role key in any `VITE_*` variable is a critical incident: rotate it immediately.
- **CI runs gitleaks** on every pull request.

### 6.6 HTTP security headers

Set in `vercel.json` and verified after the first deploy. This is the policy since M2.5, which self-hosted the font and added the service worker. Before that, M1 and M2 also allowed Google Fonts.

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |

**Notes:**

- `style-src 'unsafe-inline'` is needed for the inline styles that Radix sets for positioning. Scripts get no such exception.
- The service worker (`sw.js`) and the manifest are served with `Cache-Control: no-cache`, so an update is never hidden behind a cached worker. The app registers the worker from its own bundle, so there is no separate `registerSW.js`.
- Font files are never inlined as `data:` URLs (`build.assetsInlineLimit` in `vite.config.ts`), because `font-src 'self'` blocks them.
- Vercel's preview toolbar injects scripts from `vercel.live`. Either allow `https://vercel.live` in `script-src` for Preview only, or turn the toolbar off. Production stays strict.

### 6.7 Supply chain

- `package-lock.json` is committed. CI installs with `npm ci`.
- **`npm audit --audit-level=high` fails CI.** A finding that cannot be fixed yet needs a written exception with an expiry date (section 15).
- **Dependabot** is weekly for npm and GitHub Actions, with minor and patch updates grouped.
- **GitHub Actions are pinned to a full commit SHA,** with the version in a comment.
- **The workflow token has `permissions: contents: read`** unless a job needs more.

### 6.8 AI features (from the backend stage)

- **Student notes are data, never instructions.** When notes or summaries are sent to a model, they are wrapped and labelled as untrusted content, and the model's output is rendered as plain text (6.1).
- **The client never calls a model provider directly.** Calls go through a server function that holds the key and checks the student's enrollment first.

---

## 7. Accessibility

- **Target:** WCAG 2.1 AA (REQUIREMENTS NFR-2).
- **Automated checks:**
  - `vitest-axe` runs in every page-level component test
  - `@axe-core/playwright` runs on every route in the end-to-end suite
  - any violation fails CI
- **ESLint `jsx-a11y`,** recommended rules as errors.
- **Manual check per pull request** that adds UI: keyboard only (Tab, Shift+Tab, Enter, Space, Escape), a visible focus ring, and a logical focus order. Dialogs trap focus and return it on close.
- **Colour is never the only signal.** Status badges carry text as well as colour.

---

## 8. Performance

- **Budget:** at most 250 KB gzipped of initial JavaScript, enforced by `size-limit` in CI. From M2.5, the service-worker precache stays under 2 MB.
- **Code splitting:**
  - every route is lazy-loaded
  - the editor (Tiptap) and DOMPurify load only on pages that need them
- **TanStack Query defaults:** `staleTime` of 30 seconds for lists, and refetch on window focus. No polling in v1.
- **Images** have explicit width and height and use `loading="lazy"` below the fold.
- **Lighthouse** is checked in M6 against the landing page: LCP under 2.5 s (NFR-3).

---

## 9. Student data privacy

- **Collect only what a screen needs.** Nothing in the data model exists "just in case".
- **No third-party analytics, trackers or chat widgets** without an explicit decision in the decisions log and a consent mechanism.
- **Note content never leaves CoNote's own backend in v1.** When the AI backend lands, document exactly what is sent to the model provider and how long they keep it.
- **Export and deletion exist** from v1: FR-SET-2 (request account deletion) and FR-SET-4 (download my notes).
- **Before real student data goes in,** check which data protection law applies where CoNote will run, and record the result in the decisions log.

---

## 10. Dependencies

- **Every new runtime dependency needs a reason in the PR:** what it does, why existing code or the platform can't do it, its gzipped size, its maintenance status, and its licence.
- **Allowed licences:** MIT, Apache-2.0, BSD, ISC. Anything else needs a decision log entry.
- **Prefer the platform** (`Intl`, `URL`, `crypto.randomUUID`) and the libraries already chosen (REQUIREMENTS section 5) over new ones.

---

## 11. Git and pull request workflow

- **Branches:** `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`, `docs/<short-name>`, `test/<short-name>`.
- **Commits** follow Conventional Commits: `feat(notes): add tag picker`, `fix(auth): reject protocol-relative redirects`, `test(summary): cover in_review state`.
- **Pull requests:**
  - one feature slice each, about 400 changed lines at most, excluding tests, lockfile and generated files
  - the description links the requirement IDs it covers
  - the Definition of Done checklist from section 1 is filled in
- **Merging:**
  - CI must be green
  - at least one approving review
  - squash-merge into the default branch
- **The default branch is always deployable.** It is protected: no direct pushes and no force-pushes.

---

## 12. Documentation

- **`README.md`:** setup, scripts, environment variables and folder guide (completed in M6, started in M1).
- **Requirement IDs** (FR-…, NFR-…) are referenced in PR descriptions and, where it helps, in test names.
- **Decisions** that change behaviour or architecture get a row in the decisions log (REQUIREMENTS section 15) in the same pull request.
- **Every exported function, component, hook and type** gets a TSDoc comment, in addition to the line comments required by section 4.5.

---

## 13. Pre-commit hooks

Husky + lint-staged run on staged files:

1. Prettier (write)
2. ESLint (fix, then fail on anything left)
3. `vitest related --run` for the staged source files

A commit that fails any of these is blocked. `--no-verify` is not used; CI runs the same checks and more, so skipping the hook only delays the failure.

---

## 14. Enforcement map

| Rule | Tool | Pre-commit | CI |
|---|---|---|---|
| Formatting | Prettier | ✓ | ✓ |
| Lint, import boundaries, `jsx-a11y`, no `dangerouslySetInnerHTML`, no `console.log`, no `any` | ESLint (`typescript-eslint` strict-type-checked, `react-hooks`, `jsx-a11y`, boundaries) | ✓ | ✓ |
| Types | `tsc --noEmit` | | ✓ |
| Unit, component and contract tests | Vitest | related only | ✓ |
| Coverage floor | Vitest coverage (v8) | | ✓ |
| Accessibility | `vitest-axe`, `@axe-core/playwright` | | ✓ |
| End-to-end flows | Playwright | | ✓ |
| Bundle budget | `size-limit` | | ✓ |
| Known vulnerabilities | `npm audit --audit-level=high` | | ✓ |
| Leaked secrets | gitleaks | | ✓ |
| Dependency updates | Dependabot | | weekly |
| Definition of Done | PR template + review | | review |

---

## 15. Exceptions

A rule can be broken only with a written reason:

- **Inline:** an `eslint-disable-next-line <rule> -- <reason>` comment.
- **Longer-lived:** a row in the decisions log that names the rule, the reason, and when it will be revisited.

An exception without a reason fails review.
