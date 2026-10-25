# CoNote: handover guide

This guide is for the people who take CoNote over: the founders, their developers, and any AI
coding assistant they use. It says what CoNote is, where everything lives, how to run it, how to
change it safely, how to put changes live, and what is left to build.

Read it from the top once. After that, use the contents list to jump.

**No secret is written in this guide or anywhere in the repository.** Where a key is needed, the
guide gives its _name_ and says where to keep it.

## Contents

1. [What CoNote is](#1-what-conote-is)
2. [What exists today](#2-what-exists-today)
3. [Take over the accounts first](#3-take-over-the-accounts-first)
4. [Run it on your own machine](#4-run-it-on-your-own-machine)
5. [How the code is laid out](#5-how-the-code-is-laid-out)
6. [The rules the code follows](#6-the-rules-the-code-follows)
7. [How to make a change](#7-how-to-make-a-change)
8. [Working with an AI assistant](#8-working-with-an-ai-assistant)
9. [The live system](#9-the-live-system)
10. [Putting changes live](#10-putting-changes-live)
11. [Keys and secrets](#11-keys-and-secrets)
12. [Everyday jobs](#12-everyday-jobs)
13. [When something breaks](#13-when-something-breaks)
14. [Known gaps and loose ends](#14-known-gaps-and-loose-ends)
15. [What to build next](#15-what-to-build-next)
16. [Where the answers are](#16-where-the-answers-are)

---

## 1. What CoNote is

Students write private notes for each class. An AI reads the notes of the whole class and writes
a draft summary. A teacher reads the draft, fixes it and approves it. Students then read only the
approved summary.

Three rules sit under everything:

- **Notes are private.** Not a teacher, not an administrator, not another student can read a
  student's notes. The database enforces this, not just the screens.
- **Students never see a draft.** Only a summary a teacher approved reaches them.
- **The AI never decides alone.** A teacher is always between the AI and the student.

There are three people-facing apps and one shared backend:

| Who           | App                           | Address                  |
| ------------- | ----------------------------- | ------------------------ |
| Students      | Student portal (installable)  | `https://www.co-note.tech` |
| Teachers      | Teacher portal                | `https://teacher.co-note.tech` |
| Administrators | Admin console                | `https://admin.co-note.tech`   |

## 2. What exists today

Built and live (a one-class pilot):

- **Student:** sign up with an emailed 6-digit code, sign in, "Continue with Google", join a
  programme (an administrator approves), write and edit notes in a chat-style Home, choose the
  class (only classes that have started, today and the last two days), read approved summaries,
  Ask AI (30 questions a day), notifications, settings, light and dark theme.
- **Teacher:** sign in, see own courses and classes, open the review queue, edit a draft, approve
  and publish. A banner shows claims the AI flagged as wrong.
- **Admin:** invite, suspend, delete users; manage courses and classes; approve or decline
  programme requests; import a school timetable from a PDF; a dashboard of counts.
- **Backend:** one Supabase project (Postgres database with row-level security, sign-in, Edge
  Functions). The summary worker runs every minute and calls the Groq language model.

Every app also has a **demo mode** that runs on fake data in the browser, with no backend. It is
the default. Use it to try screens and to run tests.

Not built yet: see [section 14](#14-known-gaps-and-loose-ends) and
[section 15](#15-what-to-build-next).

## 3. Take over the accounts first

The code is only half of CoNote. The live system sits on several accounts. Whoever owns the code
must also own these. Do this before anything else, and do it while the current owner can still
help.

| Account                | What it holds                                                                 | Who must have access                  |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------- |
| **GitHub**             | The repository `Ndukwopeace/CoNote`, CI, branch rules, GitHub secrets         | Owner transfer or org membership      |
| **Supabase**           | The database, sign-in, Edge Functions, secrets, backups, email settings       | Organisation owner                    |
| **Vercel**             | Three projects: `conote`, `conote-admin`, `conote-teacher`                    | Team owner                            |
| **Domain registrar / DNS** | `co-note.tech` and the `www`, `teacher` and `admin` addresses             | Account owner                         |
| **Groq**               | The language model that writes summaries and answers questions                | Account owner (it also pays the bill) |
| **SonarCloud**         | Code quality checks on every pull request (organisation `ndukwopeace`, project `Ndukwopeace_CoNote`) | Organisation admin  |
| **Email sender (SMTP)** | Sends the sign-up code and password-reset emails to people outside the Supabase team | Account owner              |
| **Google Cloud**       | The OAuth client behind "Continue with Google"                                | Project owner                         |

Checklist:

- [ ] Transfer the GitHub repository (Settings → General → Transfer), or add the new owners as
      admins.
- [ ] Add at least **two** owners to each account. One person leaving must never lock the team out.
- [ ] Move billing for Supabase, Vercel and Groq to the new owner's card.
- [ ] **Rotate every secret** listed in [section 11](#11-keys-and-secrets) once the new owners are
      in. Anyone who held an old key must not keep working access.
- [ ] Store the new secrets in a team password manager. Never in chat, email or the repository.
- [ ] Ask the current owner to confirm in writing that nothing else exists (another Supabase
      project, a test Vercel project, a scheduled job on another service).

## 4. Run it on your own machine

You need **Node 22.22 or newer** (the file `.nvmrc` says which) and Git.

```bash
git clone <the repository address>
cd CoNote
npm ci                  # installs every app and package
npm run dev             # student app,  http://localhost:5173
npm run dev:admin       # admin console, http://localhost:5174/admin
npm run dev:teacher     # teacher portal, http://localhost:5175/teacher
```

This runs on **demo data** kept in your browser. Nothing you do reaches the live database.

Demo sign-ins:

| App     | Sign in with                                                         |
| ------- | -------------------------------------------------------------------- |
| Student | any valid email and any password                                     |
| Admin   | `admin@conote.example` / `password1`                                 |
| Teacher | `teacher@conote.example` / `password1`                               |

To clear demo data, clear the site's storage in the browser.

### Run it against a real (local) backend

Install Docker, then:

```bash
npx supabase@2.120.0 start      # starts a local copy of the backend and loads supabase/seed.sql
```

It prints a local URL and a local "anon" key. Put them in `apps/student/.env.local`:

```
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=<the local url>
VITE_SUPABASE_ANON_KEY=<the local anon key>
```

Do the same in `apps/admin` and `apps/teacher` if you want those against it too.

**Never point a local app or a test at the live project.** Some tests delete data and reset
accounts. They refuse any address that is not local, and you must keep it that way.

## 5. How the code is laid out

One repository, many folders (an npm "workspaces" monorepo).

| Folder                | What it is                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/student`        | Student portal. React, TypeScript, Vite, installable web app. **No teacher or admin screens here.** |
| `apps/admin`          | Admin console. Routes under `/admin`.                                                            |
| `apps/teacher`        | Teacher portal. Routes under `/teacher`.                                                         |
| `packages/ui`         | Shared design system: colours, spacing, buttons, forms, toasts.                                  |
| `packages/portal`     | What admin and teacher share: sign-in pages, route guards, frame, error screens.                 |
| `packages/supabase`   | What every app shares for Supabase: client, "Remember me" storage, error mapping, sign-in core.  |
| `packages/domain`     | Shared words: roles and statuses. Apps and database spell them the same way.                     |
| `packages/core`       | Shared logic: errors, safe redirects, environment checks, error reporting.                       |
| `packages/testing`    | Test-only helpers.                                                                               |
| `supabase/`           | The database: `migrations/`, `seed.sql`, `tests/` (SQL security tests), `functions/` (Edge Functions), `templates/` (email HTML), `config.toml`. |
| `docs/`               | The specifications and rules. See [section 16](#16-where-the-answers-are).                       |
| `.github/`            | CI workflow, pull-request template, dependency updates.                                          |

Inside an app (`apps/student/src`):

- `app/` has the route table and `createServices`, the **only** file that picks demo or Supabase.
- `pages/` has one folder per screen. Pages load lazily.
- `features/` has bigger pieces (Home chat, enrolment, search, auth).
- `services/` has the interfaces. `services/mock/` is the demo version, `services/supabase/` the
  real one. Both must pass the same **contract tests**.
- `lib/` has pure helpers. `hooks/` has data hooks.

The most important idea: **screens never talk to a service directly.** They call `useServices()`.
That is why one switch (`VITE_DATA_SOURCE`) moves a whole app between demo and real data.

## 6. The rules the code follows

These are not suggestions. CI or review enforces them. The full text is in
`docs/ENGINEERING_STANDARDS.md` and `CLAUDE.md`.

1. **Test first for logic.** Write a failing test, make it pass, then tidy.
2. **Every bug fix starts with a failing test** that shows the bug.
3. **No screen imports a service implementation.** Use `useServices()`.
4. **User text renders as HTML only through `SafeHtml`.** `dangerouslySetInnerHTML` is banned
   everywhere else. This blocks script injection.
5. **Every `?redirect=` value goes through `isSafeRedirect()`.** This blocks open redirects.
6. **No `any` and no `console.log`.** Report errors with `reportError()`.
7. **Every screen that shows data handles loading, empty, error and not-found.**
8. **No new dependency without a written reason** (standards section 10).
9. **Keep the docs in sync.** A new decision goes in `docs/REQUIREMENTS.md` section 15 with the
   next number (the latest is D110).
10. **Comment every statement:** what it does and why. A security line starts with `SECURITY:` and
    names the attack it blocks. JSON config files are explained in `docs/CONFIG_FILES.md`.
11. **Any ID from a URL or a form goes through `isUuid`** before it is used in a query.
12. **Only the public "anon" key may appear in a `VITE_` variable.** Everything with `VITE_` is
    baked into public JavaScript. A service key there would hand the whole database to anyone.
13. **Colours come from tokens** (`bg-card`, `text-muted-foreground`), never fixed colours, so
    light and dark both work.
14. **Form fields stay 16px on touch screens**, or iPhones zoom the page. Do not set
    `maximum-scale` in the viewport.

## 7. How to make a change

### The commands

Run these from the repository root. Run **all** of them before you push. CI runs the same set.

| Command                            | What it checks                                             |
| ---------------------------------- | ---------------------------------------------------------- |
| `npm run lint`                     | Code style and the import rules. Zero warnings allowed.    |
| `npm run format:check`             | Formatting (`npm run format` fixes it).                    |
| `npm run typecheck`                | TypeScript.                                                |
| `npm test -- --run --coverage`     | Unit and component tests, with the coverage floor.         |
| `npm run build` then `npm run size`| Production build and the bundle budget (250 KB gzip).      |
| `npm run e2e`                      | Browser tests (Playwright) against the production build.   |
| `npm run test:db`                  | SQL security tests on a throwaway Postgres.                |

Notes:

- `test:db` needs `DATABASE_URL`, a Postgres where you may create databases.
  Example: `DATABASE_URL=postgresql://user:pass@localhost:5432/postgres npm run test:db`.
- If Playwright cannot find a browser, set `PW_CHROMIUM_PATH` to a Chromium executable.
- On a small machine, `npm run lint` may run out of memory. Use
  `NODE_OPTIONS=--max-old-space-size=6144 npm run lint`.
- A pre-commit hook formats, lints and tests the files you stage.
- Some long browser tests can pass alone yet time out when the whole suite runs on a slow machine.
  Re-run the one test. If it fails again, it is real.

### The flow

1. Start from the latest `main`: `git fetch origin main && git checkout -b <your-branch> origin/main`.
2. Write the failing test. Make it pass. Tidy.
3. Update the docs (a new decision, the user flows, `CLAUDE.md` if a gotcha changed).
4. Run all the commands above.
5. Commit with a **Conventional Commit** message: `feat(notes): ...`, `fix(student): ...`,
   `docs: ...`, `refactor(...)`, `test(...)`.
6. Push and open a pull request. **One feature slice per pull request.** Fill in
   `.github/pull_request_template.md`: what changed, how it was tested, the Definition of Done
   checklist, any new dependency.
7. Wait for the checks (below). Fix what fails. Merge with **squash** only when all are green.

### The six checks that must be green

| Check                      | What it is                                                              |
| -------------------------- | ----------------------------------------------------------------------- |
| Lint, types, tests, build  | Lint, format, types, unit tests, SonarCloud scan, build, bundle budget, browser tests, `npm audit` |
| Database security tests    | The SQL tests in `supabase/tests`                                       |
| Supabase contract tests    | The same service tests run against a real local Supabase stack          |
| Secret scan                | gitleaks looks for keys in the code and history                         |
| SonarCloud Code Analysis   | Bugs, smells, security hotspots. **Aim for 0 new issues.**              |
| Vercel Preview Comments    | A preview deploy of each changed app                                    |

Common SonarCloud complaints in this code: nested ternaries, nested template literals, a
`useState` pair not named `[value, setValue]`, functions that are too complex. Fix them with small
helper functions rather than switching the rule off.

### Changing the database

- Add a **new** migration file in `supabase/migrations/`, named `YYYYMMDDHHMMSS_what_it_does.sql`.
  Never edit one that has already been applied to the live project.
- Every new table needs row-level security, and a test in `supabase/tests/` that tries to break it.
- Every new function: `revoke execute ... from public` first, then `grant` only to who needs it.
  Postgres lets everyone run a new function unless you take that away.
- Functions marked `security definer` must check who the caller is in their first lines.
- A migration reaches the live database **only when someone applies it** (section 10).

## 8. Working with an AI assistant

CoNote was built mostly with an AI coding assistant, so the repository is set up for one.

- **`CLAUDE.md`** at the root is the assistant's instruction sheet: the folder map, the
  non-negotiable rules, the commands and a long list of gotchas. Most assistants read it
  automatically. If yours does not, tell it to read `CLAUDE.md` and `docs/ENGINEERING_STANDARDS.md`
  first.
- Tell the assistant, every time: _write the failing test first; comment every statement; run the
  full set of commands before pushing; keep the docs in sync; open a pull request._
- **Keep `CLAUDE.md` current.** When you learn a trap, add one line. It is the project's memory.
- **Humans review.** Read the diff yourself, especially anything that touches `supabase/`,
  sign-in, `SafeHtml`, redirects or secrets.
- **Do not give an assistant a production key.** It does not need one. Give it the local stack.
- If the assistant can reach the live Supabase project (for example through a connector), treat
  that as a production console. Read before you write. Ask before you change data.
- An assistant is not a substitute for the checks. Green CI and zero new Sonar issues decide
  whether a change can merge.

## 9. The live system

How the pieces connect:

```
Student / Teacher / Admin browser
        |   (static apps hosted on Vercel)
        v
Supabase project  xqyokiedicjrvlmvkorc
   - Postgres + row-level security   (the rules that keep notes private)
   - Auth                            (sign-up code, password, Google)
   - Edge Functions                  (admin actions, Ask AI, the summary worker)
        ^
        |  every minute, with a secret token
   Scheduled HTTP job  ->  process-ai-jobs  ->  Groq language model
```

### Vercel

Three projects, all from this repository:

| Project          | Root Directory   | Config file             | Domain                  |
| ---------------- | ---------------- | ----------------------- | ----------------------- |
| `conote`         | repository root  | `vercel.json`           | `www.co-note.tech`      |
| `conote-admin`   | `apps/admin`     | `apps/admin/vercel.json`  | `admin.co-note.tech`  |
| `conote-teacher` | `apps/teacher`   | `apps/teacher/vercel.json`| `teacher.co-note.tech`|

- Production deploys from `main`. Every other branch gets a preview address.
- Each project needs these environment variables (Production and Preview):
  `VITE_DATA_SOURCE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
  Vite bakes them in at build time, so changing one needs a **redeploy**.
- The `vercel.json` files also set the security headers (the Content-Security-Policy and others).
  The browser tests check the app still works under them. If you add an outside service, you must
  allow it in the policy on purpose.

### Supabase

Settings that live in the Supabase dashboard, not in the code. If the project is ever recreated,
every one of these must be set again:

- **Authentication → Email:** email confirmation **on**. "Email OTP Length" = **6**
  (the student app expects 6, and 6 is the minimum Supabase allows).
- **Authentication → Email templates:** paste `supabase/templates/confirmation.html` (sign-up
  code), `supabase/templates/recovery.html` (password reset) and
  `supabase/templates/magic_link.html` (the staff sign-in code, under "Magic Link"). The local
  stack reads these files; the hosted project does not. Subject lines are in
  `supabase/config.toml`.
- **Authentication → URL configuration:** the Site URL and the redirect URLs for the three
  addresses above.
- **Authentication → SMTP:** custom SMTP. Without it, Supabase only emails people on your
  Supabase team, so real students never get their code.
- **Authentication → Providers → Google:** the client ID and secret go **in the Supabase
  dashboard only**. Never in the repository and never in a `VITE_` variable.
- **Edge Function secrets:** see [section 11](#11-keys-and-secrets).
- **The scheduled job** that wakes the summary worker: see [section 12](#12-everyday-jobs).
- **Backups:** switch them on and note how to restore (Supabase dashboard → Database → Backups).

### The Edge Functions

All are in `supabase/functions/`. Shared logic is in `_shared/`, plain TypeScript with tests. Each
function folder holds only a thin `index.ts`.

| Function               | Who calls it                | What it does                                                        |
| ---------------------- | --------------------------- | ------------------------------------------------------------------- |
| `invite-user`          | Admin                       | Creates an invited account and sends the invitation                 |
| `set-user-status`      | Admin                       | Suspends or reactivates an account                                  |
| `send-password-reset`  | Admin                       | Sends a reset email; also resends a pending invitation              |
| `delete-invitation`    | Admin                       | Removes an invitation that is still `pending`                       |
| `delete-user`          | Admin                       | Removes any other account for good                                  |
| `health`               | Admin dashboard             | Reports the health of parts of the system                           |
| `ask-ai`               | Signed-in student           | Answers a question from the student's own material (30 a day)       |
| `process-ai-jobs`      | The scheduled job, every minute | Queues a job for each class that ended, calls the model, stores a draft |

`process-ai-jobs` is deployed with JWT verification **off** (its own secret token protects it).
`ask-ai` has it **on**. `config.toml` sets this for the local stack; on the hosted project you
set it when you deploy.

## 10. Putting changes live

**Frontend (the three apps).** Merge to `main`. Vercel builds and deploys on its own. Nothing else
to do. If you changed an environment variable, redeploy by hand.

**Database migrations.** They are **not** applied by merging. After a pull request with a
migration is merged:

1. Read the migration once more. Run `npm run test:db` on the merged `main`.
2. Apply it to the live project. Either run `supabase db push` with the CLI linked to the project,
   or paste the file into the Supabase SQL editor and run it.
3. If the SQL editor or an automated tool times out on a long migration, split it: create the
   objects first, then do the grants and drops in separate runs. Check the result afterwards
   (`select * from supabase_migrations.schema_migrations`, or list the objects).
4. Make sure the migration is recorded in the migration history table, so the next person knows it
   ran.

**Edge Functions.** They are **not** deployed by merging. After changing anything in
`supabase/functions/`, deploy that function by hand (`supabase functions deploy <name>`, or the
dashboard). A brand-new function must be deployed too, with the right JWT setting and secrets.

**Email templates and dashboard settings.** Changed by hand in the dashboard.

Order when a change touches several layers: **database first, then functions, then the frontend**.
The old frontend keeps working while the new database waits for it.

## 11. Keys and secrets

Names only. Values live in the places shown, and nowhere else.

| Name                     | Where it is kept                  | What it is for                                                        |
| ------------------------ | --------------------------------- | --------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Vercel (3 projects)               | The project address. Public.                                          |
| `VITE_SUPABASE_ANON_KEY` | Vercel (3 projects)               | The public key. Safe in the browser **because** row-level security guards the data. |
| `VITE_DATA_SOURCE`       | Vercel (3 projects)               | `supabase` for live, `mock` for demo.                                 |
| `APP_URL_STUDENT`, `APP_URL_TEACHER`, `APP_URL_ADMIN` | Supabase function secrets | The addresses put in invitation and reset emails.   |
| `GROQ_API_KEY`           | Supabase function secrets         | Lets `ask-ai` and `process-ai-jobs` call the language model.          |
| `GROQ_MODEL` (optional)  | Supabase function secrets         | Picks the model. A wrong name makes jobs fail at once.                |
| `PIPELINE_TOKEN`         | Supabase function secrets **and** the scheduled job | The password the scheduled job sends to `process-ai-jobs`. |
| Supabase **service** key | Supabase only (functions get it automatically) | Full access to the database. **Never** in a `VITE_` variable, the repository, a chat, or an AI assistant. |
| `SONAR_TOKEN`            | GitHub → Settings → Secrets → Actions | Lets CI send results to SonarCloud.                               |
| Google client ID and secret | Supabase dashboard (Google provider) | "Continue with Google".                                        |
| SMTP login               | Supabase dashboard (SMTP)         | Sending email.                                                        |

How to rotate (do this on a schedule, and at once if anything leaks):

- **Groq key:** make a new key at Groq, set `GROQ_API_KEY` in Supabase, delete the old key.
- **Pipeline token:** make a long random string, set `PIPELINE_TOKEN` in Supabase **and** in the
  scheduled job together, or the worker stops answering.
- **Supabase keys:** rotate in the Supabase dashboard, then update Vercel and redeploy the three
  projects.
- **If a secret was committed:** treat it as public. Rotate it first, then clean the history.

## 12. Everyday jobs

**Add a teacher or administrator.** Admin console → Users → Invite. The person gets an email and
chooses a password. (Sign-up on the student site only ever makes students.)

**Set up a school term.** Admin console → Programmes → Import timetable. Upload the PDF, type the
term dates and time zone (default `Africa/Douala`), pick the teachers, look at the preview, then
confirm. The import is all-or-nothing. The dates and zone are typed in by a person, never guessed.

**Approve a student into a programme.** Admin console → Programmes → requests. Approving enrols
the student in every course of the programme. A student belongs to one programme.
Removing a student from a programme removes their enrolment in that programme's courses (their
notes are kept).

**Remove a test account or an old course.** Admin console → Users → Delete, or Courses → archive
then Delete. Both ask you to type the name or code first.

**The summary worker.** A scheduled HTTP job must call `process-ai-jobs` **every minute** with the
header `Authorization: Bearer <PIPELINE_TOKEN>`. The job's timeout is at most 5 seconds, so the
function answers `202` at once and finishes in the background. If the job stops, no summaries are
made, and nothing shouts about it. Check it in the first week after any change.

**A summary job that failed.** The worker retries after 2 minutes, then 4. A refused key, a model
name the service rejects, or a class with no usable notes fail straight away. A job that fails
for good stays `failed` and its summary stays `processing`. There is **no Retry button yet** (that
is task B4 in section 15). Until then, fix the cause (key, model, notes) and ask a developer to
re-queue the job through the database.

**Read the logs.** Supabase dashboard → Edge Functions → pick a function → Logs. Vercel → the
project → Deployments → a deployment → Logs.

**Back up and restore.** Supabase dashboard → Database → Backups. Practise a restore into a
throwaway project before you need one.

## 13. When something breaks

| Symptom                                   | Look at first                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| Nobody gets the sign-up code email        | Custom SMTP in Supabase; the confirmation template; the email rate limit        |
| Sign-up code is the wrong length          | "Email OTP Length" must be 6 (`SIGN_UP_CODE_LENGTH` in the student app)         |
| Password-reset link fails                 | The recovery template is pasted in; redirect URLs match the three addresses     |
| An invitation link opens the student site | The `APP_URL_*` secrets start with `https://` (without it Supabase ignores the redirect) and the three addresses are on the redirect list |
| A teacher gets no sign-in code email      | The Magic Link template is pasted in; custom SMTP; the email rate limit. They can use the password link instead |
| "Continue with Google" fails              | Google provider client ID/secret in Supabase; the redirect URI in Google Cloud  |
| An app shows demo data, or "not connected to the database yet" | `VITE_DATA_SOURCE` and the two Supabase variables in that Vercel project; redeploy |
| No summaries appear                       | The scheduled job (is it firing?); `PIPELINE_TOKEN` matches; `GROQ_API_KEY`; `process-ai-jobs` logs |
| Ask AI says it cannot answer              | `GROQ_API_KEY`; the daily limit of 30; `ask-ai` logs                            |
| Invitation emails link to the wrong place | `APP_URL_STUDENT`, `APP_URL_TEACHER`, `APP_URL_ADMIN`                           |
| Admin action is refused                   | The account must be an active administrator; read the function log              |
| A new feature works locally but not live  | Was the migration applied? Was the function deployed? Was the variable redeployed? |
| CI fails only on browser tests            | Re-run once. A timeout under load can pass alone. A second failure is real.     |
| Sonar shows new issues                    | Open the issue link in the pull request comment and fix the rule named          |
| Text looks wrong on one theme             | A fixed colour was used instead of a token                                      |
| iPhone zooms when a field is tapped       | A field is smaller than 16px                                                    |
| A long unbroken word runs off the screen  | The bubble needs `[overflow-wrap:anywhere]`                                     |

## 14. Known gaps and loose ends

Be honest about these. None blocks the pilot. Each one is a decision waiting for someone.

**Not built yet**

- **Retry for failed summary jobs**, and a failed-jobs list for admins (B4).
- **Email or push** for those notices. A teacher is told in the portal's bell and a student in
  theirs (D111), but nothing is sent outside the apps.
- The admin dashboard alerts for `delivery_failures`, `storage_errors` and `security_events`
  **read tables that nothing writes to yet**, so those alerts always show nothing.
- The `health` function leaves out the AI service and notifications until they exist.
- **No alert** on the admin dashboard for programme requests that are waiting.
- **Profile pictures** (needs Supabase Storage).
- **Resources** (uploading and sharing files) and a student Resources screen.
- Error reporting is wired to `reportError`, but check that it reaches a real service before
  relying on it.
- A friendly message for "that Google sign-in took too long, try again".
- An accessibility and responsive pass at 360, 768, 1024 and 1440 px on all three portals, and a
  Lighthouse check, as planned for launch (B5).
- A short **runbook** (this guide is the start of it).

**Things to tidy**

- The live database's `remove_from_programme` function differs from the repository's text. It
  does the same job, but was written with a workaround during a tool timeout. Re-apply the
  repository's version when convenient and re-run the programme tests.
- The `joinable_programmes` view still has an old `is_mine` column that nothing needs.
- Two small database helpers, `app.is_enrolled` and `app.class_started`, can be called by anyone
  who knows an ID. They only answer yes or no. Limiting them to signed-in users would be tidier.
- Rate limits on sign-in are Supabase's own, not CoNote's.
- The style policy allows `'unsafe-inline'` because a UI library sets inline styles. Scripts get
  no such exception.

**Rules chosen on purpose (so nobody "fixes" them by mistake)**

- Sign-up is open to anyone and always makes a **student**. Teachers and admins are invited.
- "Continue with Google" is **student only**. Elsewhere it would create stray student accounts.
- Staff sessions are never remembered.
- Notes are plain lines saved as paragraphs. There is no rich-text editor (removed in D109).
- A student chooses a class only once it has started, and only from today and the last two days
  (D107, D108). The database enforces this too.
- A student belongs to **one** programme and cannot join one without an administrator's approval
  (D106). Joining a single course on its own still works.
- The AI never repeats a claim it judges wrong as if it were true. It flags it for the teacher
  (D92, D93).
- The three apps' demo data are separate. A request made in one demo does not reach another.

## 15. What to build next

In this order, agreed with the lecturer:

1. **Class-start reminders**, built from the timetable.
2. **A feedback button**, so students can tell the team what is wrong.
3. **A participation view** for teachers and administrators: counts of who took notes, never the
   notes themselves.
4. **Revision "quiz me"**, questions made from the approved summaries.

Parked for later: an interactive first-time tour for new students.

From the original plan (`docs/MILESTONES.md`):

- **B4, minimum operations (the notifications part is built, D111):** failed-jobs list and Retry (a `retry-ai-job` Edge Function, only
  for failed jobs, limited by a maximum, written to the audit log); the dashboard alerts fed from
  real data. (The two in-app notifications are built, D111.)
- **B5, launch:** the accessibility and responsive pass, security headers checked on the live
  addresses, backups on, a runbook, and a pilot with one real class through a full cycle.
- **After launch** (parked): resources, analytics and an audit-log viewer, admin settings, offline
  note sync and push notifications, full-text search of note bodies, teacher extras.

Before you build any of these, read the matching part of `docs/REQUIREMENTS.md`, add a decision
(D111, D112, ...) that says what you chose and why, and write the failing test first.

## 16. Where the answers are

| Question                                              | Read                                                      |
| ----------------------------------------------------- | --------------------------------------------------------- |
| What is the student portal meant to do? Routes, data model, every past decision | `docs/REQUIREMENTS.md` (decisions log is section 15) |
| What did we build, in what order, and how is CI set up? | `docs/MILESTONES.md`                                    |
| Admin console spec and milestones                     | `docs/admin/REQUIREMENTS.md`, `docs/admin/MILESTONES.md`  |
| Teacher portal spec                                   | `docs/teacher/REQUIREMENTS.md`                            |
| Screens, flows and journeys                           | `docs/USER_FLOWS.md`, `docs/wireframes/`                  |
| Testing, architecture, security and review rules (binding) | `docs/ENGINEERING_STANDARDS.md`                      |
| What each JSON config file does                       | `docs/CONFIG_FILES.md`                                    |
| How to attack the system on purpose (for reviewers)   | `docs/SECURITY_REVIEW_GUIDE.md`                           |
| Traps and house rules, one line each                  | `CLAUDE.md`                                               |
| How to run each app                                   | `README.md` and [section 4](#4-run-it-on-your-own-machine) |

**First week for a new team**

- Day 1: take over the accounts ([section 3](#3-take-over-the-accounts-first)). Rotate secrets.
- Day 2: clone, run all three apps in demo mode, run every command in section 7 once.
- Day 3: start the local Supabase stack and run the app against it. Read
  `supabase/migrations/20261010000100_rls.sql` and `docs/SECURITY_REVIEW_GUIDE.md`.
- Day 4: read `docs/REQUIREMENTS.md` sections 1 to 5 and the decisions log from D100.
- Day 5: confirm the scheduled summary job is firing; pick the first task from section 15; open
  your first pull request.
