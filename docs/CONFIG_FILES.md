# Configuration files that cannot hold comments

JSON has no comment syntax, so these files are explained here, line by line (ENGINEERING_STANDARDS.md 4.5). Changing one of these files means updating this document in the same pull request.

Lines marked **SECURITY** say what the setting blocks.

---

## `vercel.json`

Tells Vercel how to build the app and which HTTP headers to send. `vite.config.ts` reads the same headers, so `npm run preview` and the browser tests run under the exact production policy.

### Build

| Line | What it does | Why |
|---|---|---|
| `"$schema"` | Points editors at Vercel's schema | Autocomplete and typo warnings while editing |
| `"framework": "vite"` | Tells Vercel this is a Vite app | Picks sensible defaults |
| `"buildCommand": "npm run build -w @conote/student"` | Runs the student app's build script: the type check, then the Vite build | A type error stops a deploy instead of shipping. `-w` picks the app inside the monorepo (D64). |
| `"outputDirectory": "apps/student/dist"` | Serves the built files from the student app's `dist/` | That is where Vite writes them. The file sits at the repository root so the existing Vercel project keeps deploying without a settings change; a future admin or teacher app gets its own Vercel project with its folder as the Root Directory. |
| `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]` | Every address serves `index.html`; React Router then shows the right page | Without it, refreshing on `/courses` or opening a shared link gives a Vercel 404. Real files such as `/assets/…` and `/favicon.svg` are still served as they are, because Vercel checks for a real file before applying a rewrite. |

### Security headers

Sent with every response (`"source": "/(.*)"`).

**`Content-Security-Policy`** is the browser's allow-list of where the page may load things from. Each directive:

| Directive | What it does | **SECURITY:** what it blocks |
|---|---|---|
| `default-src 'self'` | Anything not listed below may load only from CoNote's own address | Any resource type we forgot to list is blocked by default, not allowed |
| `script-src 'self'` | Scripts may load only from CoNote's own files | **Cross-site scripting (XSS).** Even if an attacker got HTML into a note past the sanitiser, an inline `<script>`, an `onclick=` handler or a script from another site would not run. |
| `style-src 'self' 'unsafe-inline'` | Stylesheets from CoNote only; inline styles allowed | Radix sets inline `style=` positions for menus and tooltips, so inline styles must be allowed. Styles cannot run code. Google Fonts was removed in M2.5 (D23). |
| `font-src 'self'` | Fonts from CoNote only | Blocks fonts from anywhere else, including `data:` URLs, which is why `vite.config.ts` never inlines font files. |
| `img-src 'self' data: blob: https://*.supabase.co` | Images from CoNote, inline data, local blobs (avatar previews) and Supabase storage | Stops injected images from loading from tracking servers, which could log who read a note and when |
| `worker-src 'self'` | The service worker must come from CoNote | **Malicious service worker.** A worker sits between the app and the network and can rewrite every response; only CoNote's own `sw.js` may register. |
| `manifest-src 'self'` | The web app manifest must come from CoNote | An injected `<link rel="manifest">` pointing elsewhere could rename the app or change where the installed app opens |
| `connect-src 'self' https://*.supabase.co wss://*.supabase.co` | The app may only talk to CoNote and Supabase | **Data exfiltration.** Injected code could not send notes or session tokens to an attacker's server. |
| `frame-ancestors 'none'` | No other site may show CoNote inside a frame | **Clickjacking,** where a hidden CoNote frame is placed under a fake button to trick a student into clicking "Delete" or "Sign out" |
| `base-uri 'self'` | Limits the `<base>` tag to CoNote | An injected `<base>` tag redirecting every relative link and script path to another site |
| `form-action 'self'` | Forms may only submit to CoNote | An injected form sending typed passwords to an attacker |
| `object-src 'none'` | No `<object>` or `<embed>` plugins | Old plugin-based attacks (Flash, Java applets) |

**Cache rule for the service worker and manifest** (`"source": "/(sw\\.js|manifest\\.webmanifest)"`):

| Header | Value | Why |
|---|---|---|
| `Cache-Control` | `no-cache` | Browsers must ask the server every time, so a new deploy is noticed and the update toast appears (FR-PWA-5). Without it, a cached old worker could hide updates for hours. The hashed files under `/assets/` are still cached normally. |

**Other headers:**

| Header | Value | What it does | **SECURITY:** what it blocks |
|---|---|---|---|
| `X-Content-Type-Options` | `nosniff` | The browser trusts the declared file type instead of guessing | A file served as text being "sniffed" and run as a script |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Other sites see only `https://conote…`, never the full address | Leaking note IDs or page paths to outside sites through links |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Turns off camera, microphone and location for the page | Injected code secretly asking for the camera, microphone or location |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Browsers use HTTPS only, for two years, on every subdomain | **Downgrade attacks** on public Wi-Fi, where the first request is forced to plain HTTP and the session is stolen. `preload` allows the domain to go on browsers' built-in HTTPS-only list. |

---

## `apps/admin/vercel.json`

The admin app's own Vercel project (Root Directory `apps/admin`, D66) reads this file. It matches the root `vercel.json` with these differences:

| Line | What it does | Why |
|---|---|---|
| `"installCommand": "cd ../.. && npm ci"` | Installs from the repository root | Vercel runs commands inside the Root Directory (`apps/admin`). The build tools (TypeScript, Vite, Tailwind) are declared once in the root `package.json`, so installing inside `apps/admin` left them out and the first deploy failed with `tsc: command not found`. Installing at the root gets every workspace and the shared tools, exactly as CI does. |
| `"buildCommand": "cd ../.. && npm run build -w @conote/admin"` | Builds the admin app from the root | The same command CI and local builds use |
| `"outputDirectory": "dist"` | Serves `apps/admin/dist` | Relative to the Root Directory, where Vite writes the build |
| No `sw.js` / `manifest.webmanifest` rule | Left out | The console has no service worker or manifest |
| `X-Robots-Tag: noindex, nofollow` | Tells search engines not to list any console page or follow its links | **SECURITY:** the console isn't public; listing its sign-in page would advertise it to anyone looking for targets. `index.html` also carries a `robots` meta tag. |

The CSP and the other security headers are the same as the student app's, and `npm run preview` in `apps/admin` serves them, so the admin browser tests run under the production policy.

---

## `package.json` files (npm workspaces, D64)

The repository is one npm workspace: a root `package.json`, one per app under `apps/`, and one per shared package under `packages/`. `npm ci` at the root installs everything into one `node_modules`, with one `package-lock.json`, and links each workspace in as `node_modules/@conote/<name>`.

### Root `package.json`

| Field | What it does | Why |
|---|---|---|
| `"name": "conote"` | The repository's package name | Identifies the project in tools and logs |
| `"private": true` | npm refuses to publish it | **SECURITY:** stops the source from being published to the public npm registry by mistake. Every workspace sets it too. |
| `"version"` | The repository version | Kept for tooling; each app has its own version |
| `"type": "module"` | `.js` files are ES modules | Modern `import`/`export` syntax everywhere, including `eslint.config.js` |
| `"engines": { "node": ">=22" }` | Declares the minimum Node version | React Router 8 needs Node 22.22+. `.nvmrc` pins the exact major version for CI and local setups. |
| `"workspaces": ["apps/*", "packages/*"]` | Every folder under `apps/` and `packages/` is a workspace | One install, one lock file, shared tooling versions |

| Script | Command | What it does |
|---|---|---|
| `dev`, `preview` | `npm run <script> -w @conote/student` | Runs that script in the student app |
| `dev:admin` | `npm run dev -w @conote/admin` | The admin console's dev server (port 5174) |
| `build`, `size`, `e2e` | `npm run <script> --workspaces --if-present` | Runs the script in every workspace that has it: both apps today. CI calls these, so every app is built, size-checked and browser-tested (D66). |
| `lint` | `eslint . --max-warnings=0` | Lint every app and package with the root `eslint.config.js`; any warning fails |
| `format` | `prettier --write .` | Reformat every file |
| `format:check` | `prettier --check .` | Fail if any file isn't formatted (CI) |
| `typecheck` | `tsc -b` | Type check every app and package through the root `tsconfig.json` references |
| `test` | `vitest` | Every app's unit and component tests (the root `vitest.config.ts` lists them as projects); watch mode locally, `-- --run` in CI |
| `prepare` | `husky \|\| true` | Installs the git hooks after `npm install`. `\|\| true` stops installs from failing on machines without git (such as Vercel's build machines). |

The root `devDependencies` hold the tooling every workspace shares (listed under "Dev dependencies" below), so all apps build, lint and test with the same versions.

### `lint-staged` (root `package.json`)

Runs on the files staged for a commit, from the repository root.

| Pattern | Commands | Why |
|---|---|---|
| `*.{ts,tsx}` | `prettier --write`, `eslint --fix --max-warnings=0`, `vitest related --run` | Format, lint (fixing what can be fixed automatically), then run only the tests affected by the change, in any app. A change to a shared package runs the tests of every app that uses it. |
| `*.{js,css,json,html,yml,yaml}` | `prettier --write` | Format everything else |

### `apps/student/package.json`

| Field | What it does | Why |
|---|---|---|
| `"name": "@conote/student"` | The app's workspace name | What `-w @conote/student` refers to |
| `"version"` | The app version | Shown in Settings → Help (FR-SET-5) |
| `"private"`, `"type"` | As in the root | Same reasons |

| Script | Command | What it does |
|---|---|---|
| `dev` | `vite` | Development server with instant reload |
| `build` | `tsc -b && vite build` | Type check first, then production build into `apps/student/dist`, so a type error can never ship |
| `preview` | `vite preview` | Serves the production build locally, with the production security headers |
| `size` | `size-limit` | Check the bundle budget in `apps/student/.size-limit.json` |
| `e2e` | `playwright test` | Browser tests in `apps/student/e2e` |
| `icons` | `node scripts/generate-icons.mjs` | Redraws the app icons and iPhone launch images into `apps/student/public` |

Its `dependencies` are the browser libraries listed below, plus `@conote/ui`, `@conote/domain` and `@conote/core`; its `devDependencies` hold `@conote/testing`. All four resolve to the workspace folders, never to the npm registry.

### `apps/admin/package.json`

The same fields and scripts as the student app, minus `icons`: `@conote/admin`, version, `dev` (port 5174, set in `vite.config.ts`), `build`, `preview`, `size`, `e2e` (port 4174, so it can run next to the student's 4173). Its dependencies are the subset the console uses: React, React Router, TanStack Query, react-hook-form with `@hookform/resolvers`, zod, lucide-react, the font, and the four workspace packages. No PWA or editor libraries.

### `packages/*/package.json` (`ui`, `domain`, `core`, `testing`)

| Field | What it does | Why |
|---|---|---|
| `"name"` | `@conote/ui`, `@conote/domain`, `@conote/core`, `@conote/testing` | The name apps import from, for example `@conote/ui/button` |
| `"private": true` | Never published | **SECURITY:** as above |
| `"exports"` | Maps import paths to source files: `@conote/ui/<name>` → `src/components/<name>.tsx`, `@conote/ui/common/<name>` → `src/common/<name>.tsx`, `@conote/ui/forms/<name>` → `src/forms/<name>.tsx`, `@conote/ui/utils` → `src/utils.ts`, `@conote/ui/styles/theme.css` and `…/tokens.css` → the stylesheets; `@conote/domain` → `src/index.ts`; `@conote/core/<name>` and `@conote/testing/<name>` → `src/<name>.ts` | Apps compile the package source directly (no build step for packages), and only the listed paths can be imported, so a package's internals stay private |
| `"dependencies"` (`ui`) | `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` | What the primitives use |
| `"peerDependencies"` (`ui`) | `react`, `react-dom`, `react-router` | Supplied by the app, so there is only ever one copy of each. `react-router` is needed by `SidebarLink` (D67). |
| `"dependencies"` (`core`) | `zod` | `parseEnv` checks the environment variables with it |
| `"devDependencies"` (`ui`) | `@conote/testing` | The common test setup for its component tests |
| (`testing`) | no dependencies of its own | It uses the test tooling in the root `devDependencies` (Vitest, Testing Library, axe, Playwright). Test-only: no app imports it from shipped code. |

### Dependencies (shipped to the browser)

Listed in `apps/student/package.json`, except the last four rows, which `packages/ui` declares for its primitives (`radix-ui` is in both, since the student app's confirm dialog uses it directly).

| Package | What it's for |
|---|---|
| `react`, `react-dom` | The UI library and its browser renderer |
| `react-router` | Addresses and page navigation |
| `@tanstack/react-query` | Fetching, caching and refreshing server data |
| `zod` | Checking data shapes (environment, forms, stored sessions, service responses) |
| `workbox-window` | Registers the service worker and tells the app when a new version is waiting (FR-PWA-5); loaded on its own after the first render |
| `@fontsource-variable/plus-jakarta-sans` | The Plus Jakarta Sans font files, served by CoNote itself (D23). SIL Open Font Licence. |
| `react-hook-form` | Form state and validation timing (errors on blur and on submit) without re-rendering the whole form on each keystroke (D26) |
| `@hookform/resolvers` | Connects the zod schemas to react-hook-form, so the forms and the auth service share one set of rules (D26) |
| `dompurify` | **SECURITY:** removes dangerous HTML from notes before display (XSS) |
| `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm` | The note editor (D16, D46). MIT. Loaded only with the New and Edit note pages, so the first download doesn't grow |
| `@tanstack/react-query-persist-client` | Saves and restores the notes cache for offline reading (FR-PWA-8, D49). MIT, same authors as TanStack Query |
| `radix-ui` | Accessible building blocks: menus, tooltips, avatars (keyboard support and screen-reader roles) |
| `lucide-react` | Icons |
| `class-variance-authority` | Builds class names from component variants |
| `clsx`, `tailwind-merge` | Join class names and resolve Tailwind conflicts (`cn()`) |

### Dev dependencies (tooling only, never shipped)

| Package | What it's for |
|---|---|
| `vite`, `@vitejs/plugin-react` | Build tool and its React support |
| `vite-plugin-pwa` | Generates the service worker, the precache list and the web app manifest at build time (M2.5) |
| `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css` | Styling and animations |
| `typescript`, `@types/*` | Type checking and type definitions |
| `vitest`, `@vitest/coverage-v8`, `jsdom` | Unit tests, coverage, simulated browser |
| `@testing-library/*` | Test components the way a user uses them |
| `axe-core`, `@axe-core/playwright` | Automated accessibility checks |
| `@playwright/test` | Browser tests |
| `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-*`, `globals` | Linting, including the security and accessibility rules |
| `prettier`, `prettier-plugin-tailwindcss` | Formatting, and sorting Tailwind classes consistently |
| `husky`, `lint-staged` | Pre-commit hook |
| `size-limit`, `@size-limit/file` | Bundle budget |

---

## `apps/student/.size-limit.json` and `apps/admin/.size-limit.json`

| Field | Value | Why |
|---|---|---|
| `name` | "Initial JavaScript (entry chunk)" | Label in the report |
| `path` | `dist/assets/index-*.js` (relative to the app's folder) | The entry chunk every visitor downloads first; lazy-loaded pages are not counted |
| `limit` | `250 KB` | The budget from NFR-3, so the first load stays fast on phones |
| `gzip` | `true` | Measure the compressed size, which is what is actually transferred |

---

## `.prettierrc.json`

| Option | Value | Why |
|---|---|---|
| `semi` | `false` | No semicolons at line ends |
| `singleQuote` | `true` | `'text'` rather than `"text"` in code |
| `trailingComma` | `"all"` | Trailing commas, so adding an item changes one line in a diff, not two |
| `printWidth` | `100` | Wrap lines at 100 characters |
| `plugins` | `prettier-plugin-tailwindcss` | Sorts Tailwind classes in a consistent order |
| `tailwindStylesheet` | `./apps/student/src/styles/globals.css` | Where the plugin finds the custom token classes. The student stylesheet imports the shared theme, so it knows every token class. |
| `tailwindFunctions` | `cn`, `cva` | Also sort classes written inside these helpers |

---

## `packages/ui/components.json`

shadcn/ui's settings, used if the `shadcn` command is run to add components.

| Field | Value | Why |
|---|---|---|
| `$schema` | shadcn schema | Editor autocomplete |
| `style` | `new-york` | The shadcn style the components follow |
| `rsc` | `false` | No React Server Components; this is a browser-only app |
| `tsx` | `true` | Generate TypeScript |
| `tailwind.config` | `""` | Tailwind v4 has no config file; tokens live in CSS |
| `tailwind.css` | `src/styles/theme.css` | Where theme variables are |
| `tailwind.baseColor` | `slate` | Neutral grey scale for generated defaults |
| `tailwind.cssVariables` | `true` | Components use CSS variables (the design tokens) |
| `tailwind.prefix` | `""` | No class prefix |
| `iconLibrary` | `lucide` | Icon set |
| `aliases.*` | `@conote/ui`, `@conote/ui/utils` | The package names generated files are imported by. A generated file must then import `cn` from `'../utils'` (see `CLAUDE.md`), because `@/` means each app's own `src/`. |

---

## `.nvmrc`

Contains `22`: the Node major version. `nvm use` locally and `actions/setup-node` in CI both read it, so every machine runs the same Node.
