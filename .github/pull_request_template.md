## What this changes

<!-- One or two sentences. Link the requirement IDs this covers, e.g. FR-NTE-5. -->

## How it was tested

<!-- Tests added first, and anything checked by hand (screen sizes, keyboard). -->

## Definition of Done

See `docs/ENGINEERING_STANDARDS.md` section 1. Tick what applies; explain anything left unticked.

- [ ] Tests were written before the code they cover, and pass
- [ ] Coverage thresholds still met
- [ ] Lint, format and type check clean; no new `eslint-disable` without a reason
- [ ] Loading, empty, error and not-found states handled for new data views
- [ ] Keyboard-only use works; axe checks pass; every control has a label
- [ ] Checked at 360 px and 1440 px in the Vercel preview
- [ ] No new security findings: user HTML goes through `SafeHtml`, inputs validated, no secrets
- [ ] New dependencies justified below (what, why, size, licence)
- [ ] Docs and the decisions log updated if behaviour, routes or decisions changed
- [ ] CI green

## New dependencies

<!-- Delete if none. -->
