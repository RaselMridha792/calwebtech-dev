# 15. Next tasks — for the collaborator on `tumit`

Written 2026-09-26. The rules have not changed:
- you work on `tumit`, push there, and open PRs from `tumit` against `main`;
- you do not merge your own PR, and you do not deploy; the owner verifies and ships;
- everything in `docs/13-collaborator-handoff.md` about reading order and workflow still applies.

`docs/14-remaining-work.md` is finished: every task in it is done (decisions 55 to 65), apart
from the service-by-city matrix, which is task 6 here.

## Where things stand

- **Production runs `main` at `cc36854`**: everything through decision 65, including your
  PR #32 (the dashboard rebuild, AI providers and the HelloWay photographs).
- **`tumit` is `main` plus this document.** `git pull` before you start.
- **Read decision 66 first.** It records the owner's answers of 2026-09-26, and one of them
  changes how you work:

  > **Production now reads services, industries, case studies (`work`), the homepage copy
  > (`home`) and the thank-you copy from the database.** Editing their snapshot files
  > (`apps/web/static-content/…`) no longer changes the live site. It still changes a new or
  > empty database (through the import) and the tests, so keep the snapshots right. But when
  > a PR changes words in one of these five families, **its description must list the
  > dashboard edits production needs**, because the owner makes them by hand.

  On the homepage only the words (`content`) come from the database. Its proof — projects,
  the comparison's name and figures, testimonials, statistics — still comes from `home.json`,
  so a change there does reach production with the next deploy.

## Your tasks, in this order

Each is one PR, or a few small ones. The first two are small; the matrix is last because it
starts with questions for the owner.

### 1. The comparison's words: HelloWay, and no invented figures
**Done on `tumit`, 2026-09-26 (decision 67). Production needs one dashboard edit: the
homepage's before and after introduction, "Halloway Group's homepage" → "HelloWay's
homepage".**

Decision 66. The homepage comparison and `/before-and-after/` say "Halloway Group" beside
photographs of a site called HelloWay, with three figures nobody measured.
- In `apps/web/static-content/home.json`, `beforeAfter`:
  - `clientName` becomes `HelloWay`;
  - `metrics` becomes `[]`.
- In `apps/web/static-content/work/before-and-after.json`, the comparison: the same two
  changes, and a heading that names HelloWay ("What changed when HelloWay's website was
  redesigned?"). `work.test.ts` holds the two pairs equal.
- `home.json`'s `content.beforeAfter.intro` names Halloway Group too. Change it in the snapshot
  for the tests and a fresh database, and say in the PR that production needs the same edit
  from `/admin/page-copy/` → Homepage.
- Check both pages with no figures, at 360px and 1440px: the slider, the empty space where
  the figures were, and the heading.
- Leave alone:
  - the landing page's comparison, which has its own mock-ups and figures;
  - the video testimonial credited to "Halloway Group", which is demo proof the owner will
    replace;
  - any test fixture that uses the name as sample data.

### 2. `settings-cli` writes to the audit log
**Done on `tumit`, 2026-09-26 (decision 68). No dashboard edits needed.**

Open entry in docs/08. `CLAUDE.md` wants an audit entry for every content change.
- Every `set` in `apps/api/src/settings-cli.ts` should write one: the key, and what changed.
- Use the same audit writer the page copy screen uses (decision 59), so both appear in one
  place in the dashboard.
- The actor is the command line, not a user. `admin-cli.ts` already audits `create-owner`
  and `set-password` and marks them `via: 'admin-cli'`; do the same with `via: 'settings-cli'`.
- A setting can hold a secret. Never write a secret value into the log.

### 3. Where start-a-project briefs are abandoned
**Done on `tumit`, 2026-09-26 (decision 69). No dashboard edits needed.**

Open entry "Nothing reports abandonment yet", and the gate of Task 5.2 in
`docs/06-build-plan.md`: abandonment must be measurable per step.
- The data is already there: each draft lead's step, and its `draft_*` activities
  (decision 56, `apps/api/src/forms/forms.service.ts`).
- Build a small report in the dashboard for a chosen period:
  - how many briefs reached each step;
  - how many stopped there;
  - how many were finished.
- In the leads inbox, a filter for unfinished briefs, so the owner does not read one as an
  ordinary new lead.
- The report only reads. Enforce RBAC in the API, and match the dashboard's visual system
  (decision 63).

### 4. A case study's testimonial, and `/before-and-after/`, from the dashboard
Open entry "Not editable from the dashboard yet". Non-negotiable 3: publishing never
requires a deploy.
- **The case study editor** (decision 58) edits the case study's quote and video testimonial.
  - They are `Testimonial` rows (`packages/db/prisma/schema.prisma`: quote, client name, role,
    company, avatar, `videoUrl`, `consentAt`, `projectId`).
  - The editor adds, changes and removes them, with every change audited.
  - A testimonial is published only with a consent date: `consentAt` is the permission to
    publish.
  - Render them the way the case study template already does, and keep the video out of the
    page's first load.
- **`/before-and-after/`** becomes editable, database-first like decisions 58 and 59, with
  every change audited:
  - each comparison's name, heading and summary;
  - its two images, each with alt text, width and height (decision 65);
  - up to four figures.
- **The homepage and `/before-and-after/` show one comparison** (`work.test.ts`). The
  homepage's copy is in the database, but its comparison is proof from the snapshot. Say in
  your plan how an edit reaches both — this is the one design question in the task.

### 5. An outbox for lead and booking emails
**Done on `tumit`, 2026-09-26 (decision 71). No dashboard edits needed. The deploy applies a
forward-only migration (`20260926160000_email_outbox`), and the worker must be deployed with
the API.**

Open entry "Emails are queued after the lead commits". If the API dies between committing a
lead or a booking and queuing its emails, the emails are lost, and nothing records it.
- Follow the campaign sends (decision 51):
  - write the email jobs as rows in the same transaction as the lead or the booking;
  - let a sweep in the worker queue any row that has not been queued;
  - give each job an id that cannot be sent twice.
- It covers every email a lead or a booking sends:
  - the internal notification;
  - the acknowledgement;
  - the calculator's result;
  - the booking confirmation, the reminders, and the move and cancel emails (decision 60).
- Production sends nothing yet (`EMAIL_TRANSPORT=log`). The outbox must work with the log
  transport, and an integration test must show the crash case: a lead committed, the process
  gone before the enqueue, the email sent after the sweep.
- The migration is forward-only.

### 6. The service-by-city matrix (Task 3.2)
**Plan and questions written in `docs/16-service-city-matrix.md` (2026-09-26); no code until the
owner answers Q1 to Q11.** Two blockers were found, which are steps 1 and 2 of the plan:
production has no Location rows (the city pages are snapshot-only), and stored redirects are
written but never served.

The owner wants it (decision 66). Gate in `docs/06-build-plan.md`: no matrix page duplicates
its parent service or location page.
- **Start with a plan and questions, not code.** The docs do not agree with each other or with
  the site:
  - `docs/03-page-specs.md` says nine pages at launch. `docs/04-seo-keyword-map.md` crosses
    three services with four cities, which is twelve.
  - One of those services, `b2b-web-design`, is not a service on the site.
  - Of those cities only Sacramento exists; the live city pages are Sacramento and Austin.
  - The docs write the URL as `/<service>/<city>/`, while services live at
    `/services/<slug>/`.

  Put these to the owner in your plan, with a recommendation for each.
- Build the machinery, every part editable from the dashboard:
  - the content type: one service and one location, with its own answer block, local content,
    FAQs and SEO fields, and a migration;
  - the template, with its structured data (`docs/03-page-specs.md`);
  - the admin editor, which warns when a page's content is less than sixty per cent different
    from its parent service or location (`docs/04-seo-keyword-map.md`);
  - sitemap entries, and a redirect when a published slug changes;
  - links from the parent service and location pages to the matrix pages that are published.
- **Do not publish invented local content.** A matrix page exists only where there is
  something real to say about that service in that city. Drafts are fine; the owner writes
  and publishes the rest.
- It is a new family. It reads the database from the start and has no snapshot, so with the
  family off, no matrix page exists. Name the family in the PR. The owner adds it to
  production's `CONTENT_DATABASE_FIRST` after the deploy.

## Not yours — leave these alone

These wait on the owner, or on something only the owner can provide (decision 66). Do not
start them, and do not work around them.

- **Email sending (Task 6.2).** No provider, no credentials. Production logs every email.
- **Monitoring (Task 6.3).** Just before launch, the owner's choice.
- **Off-site backups (Task 6.4).** The owner's choice of provider, not now.
- **AI features.** AI is connected (decision 64) and nothing uses it until the owner picks a
  feature.
- **`navy-900-invert`.** The owner chose to leave it as it is.
- **The demo proof**: client names, figures, testimonials and portraits. The owner supplies
  the real ones; do not invent replacements. Every page stays noindex.
- **Launch (Task 6.5)**: the domain, DNS, indexing and Search Console.
- **Design tokens, section layouts, copy and the logo** (RULES.md, section 1). The comparison's
  words in task 1 are the exception: the owner decided them.
- **Production.**
  - No deploys.
  - No `settings-cli` against production.
  - No edits in the live dashboard.
  - The dashboard edits decision 66 leaves to the owner are theirs: the floating button, the
    footer's search link and the comparison's introducing sentence.

## How a PR is judged

As in `docs/14-remaining-work.md`:
- CI is green: type check, lint, unit, integration and e2e tests, the Lighthouse gate and the
  own-JS budget. Import only types from the `@calwebtech/shared` barrel in a client
  component.
- You checked it at 360px and 1440px and by keyboard, and the PR says so.
- Every decision that is not obvious from the code is in `docs/08-decisions.md`.
- The description says what changed, how you verified it, and what is still open.

And one new rule: **a PR that changes words in a database-first family lists the dashboard
edits production needs.**

## The prompt

Open the repo in Claude Code on `tumit` (`git pull` first) and paste this:

> Read `RULES.md`, `CLAUDE.md`, `docs/13-collaborator-handoff.md` and
> `docs/15-next-tasks.md`, then decisions 44, 51, 56, 58, 59, 60, 63, 65 and 66 in
> `docs/08-decisions.md`. I am working on the `tumit` branch and my next task is task N in
> `docs/15-next-tasks.md`. Production reads five content families from the database now
> (decision 66), so a snapshot edit in those families does not reach the live site: keep that
> in mind in everything you plan. Read the code the task builds on, then tell me:
> - what already exists that it should reuse;
> - what is missing;
> - anything in the docs that contradicts the code;
> - a plan in mergeable steps, with how each step will be verified (tests, 360px and 1440px,
>   keyboard).
>
> Do not write code until I have agreed the plan. Do not touch anything listed under
> "Not yours".

Replace N with the task number, starting at 1.
