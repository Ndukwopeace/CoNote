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
| `"buildCommand": "npm run build"` | Runs the type check, then the Vite build | A type error stops a deploy instead of shipping |
| `"outputDirectory": "dist"` | Serves the built files from `dist/` | That is where Vite writes them |
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

## `package.json`

### Top-level fields

| Field | What it does | Why |
|---|---|---|
| `"name"` | The package name | Identifies the project in tools and logs |
| `"private": true` | npm refuses to publish this package | **SECURITY:** stops the app's source from being published to the public npm registry by accident |
| `"version"` | The app version | Shown later in Settings → Help (FR-SET-5) |
| `"type": "module"` | `.js` files are ES modules | Modern `import`/`export` syntax everywhere, including `eslint.config.js` |
| `"engines": { "node": ">=22" }` | Declares the minimum Node version | React Router 8 needs Node 22.22+. `.nvmrc` pins the exact major version. |

### Scripts

| Script | Command | What it does |
|---|---|---|
| `dev` | `vite` | Development server with instant reload |
| `build` | `tsc -b && vite build` | Type check first, then production build, so a type error can never ship |
| `preview` | `vite preview` | Serves the production build locally, with the production security headers |
| `lint` | `eslint . --max-warnings=0` | Lint everything; any warning fails |
| `format` | `prettier --write .` | Reformat every file |
| `format:check` | `prettier --check .` | Fail if any file isn't formatted (CI) |
| `typecheck` | `tsc -b` | Type check only |
| `test` | `vitest` | Unit and component tests; watch mode locally, `-- --run` in CI |
| `size` | `size-limit` | Check the bundle budget in `.size-limit.json` |
| `e2e` | `playwright test` | Browser tests |
| `prepare` | `husky \|\| true` | Installs the git hooks after `npm install`. `\|\| true` stops installs from failing on machines without git, such as Vercel's build servers. |

### `lint-staged`

Run by the pre-commit hook on staged files only.

| Pattern | Commands | Why |
|---|---|---|
| `*.{ts,tsx}` | `prettier --write`, `eslint --fix --max-warnings=0`, `vitest related --run` | Format, lint (fixing what can be fixed automatically), and run only the tests affected by the change |
| `*.{js,css,json,html,yml,yaml}` | `prettier --write` | Format everything else |

### Dependencies (shipped to the browser)

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

## `.size-limit.json`

| Field | Value | Why |
|---|---|---|
| `name` | "Initial JavaScript (entry chunk)" | Label in the report |
| `path` | `dist/assets/index-*.js` | The entry chunk every visitor downloads first; lazy-loaded pages are not counted |
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
| `tailwindStylesheet` | `./src/styles/globals.css` | Where the plugin finds the custom token classes |
| `tailwindFunctions` | `cn`, `cva` | Also sort classes written inside these helpers |

---

## `components.json`

shadcn/ui's settings, used if the `shadcn` command is run to add components.

| Field | Value | Why |
|---|---|---|
| `$schema` | shadcn schema | Editor autocomplete |
| `style` | `new-york` | The shadcn style the components follow |
| `rsc` | `false` | No React Server Components; this is a browser-only app |
| `tsx` | `true` | Generate TypeScript |
| `tailwind.config` | `""` | Tailwind v4 has no config file; tokens live in CSS |
| `tailwind.css` | `src/styles/globals.css` | Where theme variables are |
| `tailwind.baseColor` | `slate` | Neutral grey scale for generated defaults |
| `tailwind.cssVariables` | `true` | Components use CSS variables (the design tokens) |
| `tailwind.prefix` | `""` | No class prefix |
| `iconLibrary` | `lucide` | Icon set |
| `aliases.*` | `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks` | Where generated files go and how they import each other |

---

## `.nvmrc`

Contains `22`: the Node major version. `nvm use` locally and `actions/setup-node` in CI both read it, so every machine runs the same Node.
