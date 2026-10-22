# CoNote: security review guide

For classmates who want to help by reading the code and trying to break it. You do not have to write any code. A clear written finding is worth more than a patch.

## 1. Ground rules

- **Test your own copy, not the live site.** The hosted app holds real students' notes. Run CoNote on your own machine (section 2) and attack that.
- **Do not touch the live site** (`co-note.tech` and its teacher and admin subdomains) unless the owner has agreed in writing what you may do and when. No load testing, no password guessing, no tricking real people.
- **Report privately.** Send findings to the repository owner directly, not in a public issue or a group chat.
- **Never ask for or share secrets.** You do not need the Supabase service key, the pipeline token or the Groq key. Everything here works without them. If you ever see one in the code, tell the owner at once.
- **Do not push to `main`.** Fork the repository or work on a branch and open a pull request. Nothing merges until its checks are green.

## 2. Run it on your machine

You need **Node 22.22 or newer** (`.nvmrc`) and Git.

```bash
git clone <repository address>
cd conote
npm ci                  # installs every app and package
npm run dev             # the student app, http://localhost:5173
npm run dev:admin       # the admin console, http://localhost:5174/admin
npm run dev:teacher     # the teacher portal, http://localhost:5175/teacher
```

This runs on **demo data** kept in your browser, so nothing you do reaches the live database.

| App     | Demo sign-in                                                                 |
| ------- | ---------------------------------------------------------------------------- |
| Student | any valid email and any password                                             |
| Admin   | `admin@conote.example` / `password1` (the teacher and student ones are refused) |
| Teacher | `teacher@conote.example` / `password1` (the admin and student ones are refused) |

Demo mode has no real database, so it cannot show database rule flaws. For those, run the SQL tests or a local database:

- **SQL security tests:** `npm run test:db` builds a throwaway Postgres from the migrations and runs every test in `supabase/tests`. It needs a Postgres you may create databases on: `DATABASE_URL=postgresql://user:pass@localhost:5432/postgres npm run test:db`.
- **Full local stack:** with Docker installed, `npx supabase@2.120.0 start` starts a local copy of the backend and loads `supabase/seed.sql`. Point an app at it with `VITE_DATA_SOURCE=supabase`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/student/.env.local`. Use the local anon key the command prints. **Never use a key from the hosted project.**

Other checks, as the project runs them: `npm run lint`, `npm run typecheck`, `npm test -- --run`.

## 3. Where the security lives

| What                                  | Where to read                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| The rules the project follows         | `docs/ENGINEERING_STANDARDS.md`, section 6 (security) and 9 (student data)                      |
| Who may read and write each table     | `supabase/migrations/20261010000100_rls.sql`, and the later migrations beside it                |
| Tests that try to break those rules   | `supabase/tests/*.test.sql` (start with `rls.test.sql` and `workflows.test.sql`)                |
| Server-side actions and their checks  | `supabase/functions/` (`_shared` holds the logic; one folder per function)                      |
| Showing a student's note as HTML      | `apps/student/src/components/common/SafeHtml.tsx` (DOMPurify with an allow-list)                |
| Redirects after sign-in               | `packages/core/src/isSafeRedirect.ts` and its test                                              |
| Sign-in and sessions                  | `packages/supabase/src/sessionCore.ts`, `packages/portal/src/` (guards, staff sign-in)          |
| Browser security headers              | `vercel.json` in the root, in `apps/admin` and in `apps/teacher`                                |
| The AI features                       | `supabase/functions/ask-ai`, `supabase/functions/process-ai-jobs`, `supabase/functions/_shared/model.ts` |
| Decisions and why                     | `docs/REQUIREMENTS.md`, the decisions log (D1 and up)                                          |

## 4. What to try, in order of value

**1. Can a student read someone else's notes?** Notes are private to their author. Not an administrator, a teacher or another student should read them. Read the `notes` policies in `20261010000100_rls.sql`, then try to find a path that reads or changes a note that is not yours (a view, a function, a count that leaks content).

**2. Can a student write where they should not?** Notes in a course they are not in. Notes under a class that has not started (rule D107). Changing their own role or programme. Joining a programme without approval (D106). Look at every `insert` and `update` policy and every function marked `security definer`.

**3. Can one role act as another?** A student calling an admin function. A teacher reading another teacher's course or draft summaries. An administrator action that skips the audit log. Check each function's first lines for its role check.

**4. Can a note run code?** Notes are stored as HTML and shown through DOMPurify. Try the usual payloads (script tags, event attributes, `javascript:` links, SVG, nested tags) in a note, a title, a tag, a course name, a profile name. Everything a user types should come out as text.

**5. Are redirects safe?** Anything after `?redirect=`. Try `//evil.com`, `/\evil.com`, encoded variants, `javascript:` URLs.

**6. Can the AI be talked into something?** Notes are sent to a model to write a draft summary. Try notes that give the model instructions, pretend to be the teacher, or ask for another student's notes. The rules say notes are data, never instructions, and replies are shown as plain text. Check the prompts in `supabase/functions/_shared` and see whether the output can reach another student before a teacher approves it.

**7. Sign-in and recovery.** Sign-up codes, password reset links, the "Remember me" choice, what sign-out clears, what a suspended account can still do, whether error messages reveal that an email exists.

**8. Limits.** A student may ask the AI 30 questions a day. Notes have size and tag limits. Can either be skipped by calling the API directly instead of using the screen?

**9. The browser.** Read the Content-Security-Policy in `vercel.json`. Is anything in it wider than it needs to be? Does the service worker cache anything private, and does sign-out remove it?

**10. Dependencies and secrets.** `npm audit`, anything that looks like a key or a token in the code or the history (`git log -p` is allowed to be slow).

## 5. Already known

These are known and not worth a report on their own, but a better fix is welcome:

- Styles allow `'unsafe-inline'` in the policy, because a UI library sets inline styles. Scripts get no such exception.
- Two small database helper functions (`app.is_enrolled`, `app.class_started`) can be called by anyone who knows an ID. They only answer yes or no.
- Rate limits on sign-in are Supabase's, not CoNote's.
- The demo (mock) mode has no real access control. It is for trying the screens.

## 6. How to report a finding

One finding per message. Keep it short and give a way to repeat it.

```
Title:        one line
Where:        file and line, or the screen and the steps
What I did:   the exact steps or the request
What happened:  what I saw
What should happen:  what the rule says
Who it affects:  students / teachers / admins, and how many
How bad:      your honest guess (low / medium / high) and why
Fix idea:     optional
```

Do not include real people's data, and do not keep a copy of anything you were not meant to see. If you found a way to read someone else's notes, stop there and report it.

## 7. If you want to fix something

- Open a pull request from your fork or a branch. One change per pull request.
- Write the failing test first, then the fix (`docs/ENGINEERING_STANDARDS.md`, section 2). A security fix without a test will be sent back.
- Run `npm run lint`, `npm run typecheck`, `npm test -- --run` and, for database changes, `npm run test:db` before you push.
- Keep comments on every statement, as the rest of the code does. Security lines start with `SECURITY:` and name the attack they block.
