# 14. Remaining work — for the collaborator on `tumit`

Written 2026-09-25. You work on `tumit`, push there, and open PRs from `tumit` against `main`.
You do not merge your own PR and you do not deploy; the owner verifies and ships. Everything
in `docs/13-collaborator-handoff.md` about reading order, rules and workflow still applies.

## Where things stand

- **Production** runs `main` at `003150c`: the 2026 brand, services in the database, the
  booking engine with its calendar and availability screen, the admin dashboard, and your
  campaign engine (decisions 49 to 52).
- **`tumit` is ahead of `main`.** Besides your three commits of 2026-09-24, it now carries
  the owner's revision of 2026-09-22 and "Subscribe now" (decisions 53 and 54): Technology
  under Resources, the booking thank-you page, the industries in the owner's order with Spa
  centres, Media and Law added, no scroll reveal, and the telephone off the whole site. Our
  two footer changes were merged into one — **your `footer.offices` and
  `footer.contactEmail` design was kept**, the snapshot's office now reads "California" /
  "United States" (the owner gave no street address), and the telephone is removed
  everywhere, not only in the footer. Read decision 54 and the first Open entry before you
  touch the footer or the contact details again.
- `session.md`'s build-plan table is current as of 2026-09-24; use it as the map.

## Your tasks, in this order

Each is one PR (or a few small ones). The first three are small and unblock the owner; the
rest follow the build plan.

### 1. The insights newsletter block creates a subscriber
**Done on `tumit`, 2026-09-25 (decision 55).**
`apps/web/components/insights/subscribe-form.tsx` and `subscribe-action.ts` still post a
`RESOURCE` lead, so nobody who subscribes from an article reaches the campaign engine.
Point it at `POST /subscribers` (`apps/api/src/subscribers/`, contract
`packages/shared/src/subscribe.ts`), with the article's path as `sourcePage`. Its name
field goes (decision 53: an address and nothing else). Keep its copy in the `insights.copy`
setting. Remove the long comment in both files about the foundation not carrying
`sourcePage` — it does now.

### 2. The start-a-project page (Task 5.2)
**Done on `tumit`, 2026-09-25 (decision 56).**
The contract, the API with progressive draft saving, the getters and the copy snapshot came
back in PR #11 (`recover/pages2-forms`); the web route and components were never built, so
`/start-a-project/` answers 404. Build the multi-step page on them. The gate is in
`docs/06-build-plan.md`: **abandonment is measurable per step**. Match the booking form's
multi-step pattern (`apps/web/components/booking/booking-form.tsx`: every step in the DOM
with `hidden`, `reportValidity()` before a step hides its required fields, and the lessons in
decision 47 about Turnstile and client-module constants).

### 3. The free website audit page
Same family, same PR #11 pieces, same 404 at `/free-website-audit/`. The Resources menu and
the contact page point visitors at an audit that does not exist yet.

### 4. Editing from `/admin` what is still edited by a deploy
Non-negotiable 3 in `CLAUDE.md`: publishing never requires a deploy. Today these still do:
- **Industries and case studies.** Move each family database-first the way services moved
  (decision 44: read the database, fall back to the snapshot), with an importer family of its
  own — the import marker records which families have run, and a family it does not name is
  the only thing a deploy imports into a live database without re-importing families somebody
  has since edited (`packages/db/src/import/index.ts`, and `booking.ts` beside it as the
  example) — and admin screens to add, edit and delete like services'.
  Industries were just reordered and three were added on `tumit`; import that state.
- **Singleton copy:** the homepage content (`home.content`), the booking page copy
  (`booking.page`), and the thank-you copy. `settings-cli` is the only way to change them.
  Admin screens for these, audited like every content change.

### 5. The rest of the booking engine (Task 5.1)
`.ics` invite on the confirmation, reminder emails 24 hours and 1 hour before (delayed
worker jobs; a cancelled or moved booking must cancel its reminders), and signed reschedule
and cancel pages. The tokens already exist: `Booking.rescheduleToken` and `cancelToken` are
generated on every booking and returned in the confirmation. Reschedule must go through the
same slot rules and the same database constraint as a new booking (decision 47). All of it
works with `EMAIL_TRANSPORT=log`, so it can be built and tested before email is switched on.

### 6. Anti-spam (Task 6.1)
Timing checks (a form submitted faster than a person can fill it), per-email rate limits,
MX and disposable-domain checks, and duplicate-lead merging that updates the existing lead
rather than creating a second. Apply to leads, bookings and subscribers alike.

### 7. Smaller gaps
- `llms.txt` (Task 1.4) — the only piece of the metadata layer missing.
- Site search (Task 4.3).
- The service-by-city matrix (Task 3.2), if the owner still wants it — ask first.

## Not yours — leave these alone

These wait on the owner, or on something only the owner can provide. Do not start them, and
do not work around them.

- **Email sending (Task 6.2).** The owner chose not to set up an email provider yet, so
  production sends nothing (`EMAIL_TRANSPORT=log`). Do not add a provider or credentials.
- **Content the owner has to approve:** the Spa centres, Media and Law pages are a draft
  awaiting review; the booking thank-you page says a confirmation email is on its way,
  which is not true while no email is sent — the owner decides the wording. Leave both texts
  as they are unless the owner says otherwise.
- **Anything third-party:** Sentry, Umami or any other service (RULES.md, section 1).
- **Launch (Task 6.5):** the client's domain, DNS, indexing (every page is noindex) and
  Search Console.
- **Backups (Task 6.4):** the off-site provider is the owner's choice.
- **Design tokens, section layouts, copy and the logo** (RULES.md, section 1).
- **Production and the server.** No deploys, no `settings-cli` against production. After the
  next deploy the owner changes production's `site.contact` setting to the new values
  (decision 54); that is not part of your work.

## How a PR is judged

The owner verifies after you; make that quick for them.
- CI green: type check, lint, unit, integration, e2e, the Lighthouse gate and the own-JS
  budget (a value import from the `@calwebtech/shared` barrel in a client component is the
  usual way to break the budget — import types only, or use a subpath entry).
- Checked at 360px and 1440px and by keyboard, and said so in the PR.
- Each decision that is not obvious from the code is written into `docs/08-decisions.md`, as
  you have been doing.
- The PR description says what changed, how it was verified, and what is still open.

## The prompt

Open the repo in Claude Code on `tumit` (`git pull` first) and paste this:

> Read `RULES.md`, `CLAUDE.md`, `docs/13-collaborator-handoff.md` and
> `docs/14-remaining-work.md`, then decisions 44, 47, 53 and 54 in
> `docs/08-decisions.md` and the build-plan table in `session.md`. I am working on the
> `tumit` branch and my next task is task N in `docs/14-remaining-work.md`. Read the code
> that task builds on, then tell me: what already exists that it should reuse, what is
> missing, anything in the docs that contradicts the code, and a plan in mergeable steps with
> how each step will be verified (tests, 360px and 1440px, keyboard). Do not write code
> until I have agreed the plan. Do not touch anything listed under "Not yours".

Replace N with the task number, starting at 1.
