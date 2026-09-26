# 17. Next tasks — for the collaborator on `tumit`

Written 2026-09-27. It lists everything left that is yours, in order. The rules have not
changed:
- you work on `tumit` and open PRs from `tumit` against `main`;
- you do not merge your own PR, and you do not deploy;
- `docs/13-collaborator-handoff.md` still holds the reading order and the workflow.

`docs/15-next-tasks.md` is done: tasks 1 to 5 (decisions 67 to 71), and the redesign the owner
confirmed (decisions 72 to 74). Task 6, the service-by-city matrix, continues here as task 1.

## Before you push anything

**PR #33 is open** and holds all of your work up to decision 74. The owner merges and deploys
it. Anything pushed to `tumit` before it is merged joins that PR, unreviewed. So:
- check with `gh pr view 33 --json state`;
- until it says `MERGED`, commit locally and do not push;
- once it is merged, `git pull origin main` into `tumit` and carry on.

## What production looks like

- After PR #33 is deployed, production reads six families from the database: services,
  industries, `work`, `home`, `thank-you` and `before-and-after`. A snapshot edit in those
  families never reaches the live site (decision 66).
- **Every family you move into the database follows the same pattern:**
  - an importer appended to the **end** of `IMPORTERS` (`packages/db/src/import/index.ts`),
    so a live database runs only the new one;
  - the importer writes only where nothing is stored, so later edits are never overwritten;
  - the page keeps its snapshot until the owner names the family in
    `CONTENT_DATABASE_FIRST`;
  - the PR description ends with **"What production needs"**: the family name to add, and any
    dashboard edit.

## Your tasks, in this order

Each task is one or more PRs. Each step inside a task should be mergeable on its own.

### 1. The service-by-city matrix, as decision 74 settled it
Read decision 74, then `docs/16-service-city-matrix.md`. Where they differ, the decision wins.
First update docs/16's plan to the decision. Then build it in this order:
1. **Serve stored redirects**, for services, industries, case studies and the matrix (docs/16,
   step 1): one redirect writer, no chains or loops, a 308 from Next.js. This also fixes the
   Open entry "Stored redirects are written but never served".
2. **Import the locations.** A `locations` importer family writes Sacramento and Austin, with
   a test that the API's view of each equals its snapshot. The city pages keep their snapshots.
3. **A location editor**, which docs/16 left out and decision 74 adds.
   - The owner will create San Francisco, Los Angeles and San Diego from the dashboard, so it
     creates, edits, publishes and removes a city page.
   - It carries Task 3.1's rules:
     - the answer block;
     - the sixty per cent uniqueness warning (`locationUniqueShare`);
     - nearby cities capped at six;
     - SEO fields;
     - a redirect when a published slug changes.
   - It does not publish invented cities. The three new cities stay drafts until the owner
     writes them.
4. **The matrix itself**, docs/16 steps 3 to 7:
   - the `ServiceLocation` type, migration and contract;
   - the page at `/services/<service>/<city>/`;
   - the editor. The API refuses to publish below sixty per cent, measured against both
     parents and the sibling pages;
   - sitemap entries, and redirects when a parent's slug changes;
   - the parent links.

   The family is `service-locations`.
5. **The docs.** Correct `docs/03`, `docs/04` and `docs/06` to decision 74:
   - nine pages;
   - the address;
   - Austin's tier;
   - no `b2b-web-design` in the matrix.

**No invented local content, anywhere.** The nine pairs and the three cities are the owner's
to write. Launch seeds get no matrix or new city rows. Fixtures are for development and CI
only.

### 2. Articles from the dashboard (`Post`, `PostCategory`)
Non-negotiable 3: publishing never requires a deploy. Today a new article needs one. This is
the next type in `docs/12-admin-dashboard.md`'s order.
- An `insights` family, database-first, with its importer, for the eight articles and the
  categories.
- The listing and editor from docs/12, section 6:
  - search, filter and status;
  - draft, scheduled and published, with a preview for drafts;
  - the SEO panel, counted live;
  - the answer block;
  - the slug, with a redirect on change;
  - the cover and OG image picked from the media library.
- **The body is MDX, edited without a raw JSON or code textarea** (docs/12 says so for
  `Post.body`). Say in your plan how headings, lists, links, images and the article's own
  blocks are edited.
- The sitemap, `/search/` and `llms.txt` follow the database once the family is on. The
  article's subscribe block and the `insights.copy` setting stay as they are.

### 3. The rest of the content types, by page family
Each group is a database-first family, with an importer and the listing and editor from
docs/12. They go in docs/12's order, grouped by the pages they feed:
1. **The company pages:** `TeamMember`, `Award`, `Partner` and `Technology`, for `/team/`,
   `/awards/`, `/partners/`, `/technology/` and the about page. Also `/testimonials/`, from the
   `Testimonial` rows decision 70 already edits.
2. **The static pages' records:**
   - `Faq` for `/faq/`;
   - `ProcessStep` for `/process/`;
   - `PricingTier` for `/pricing/`.
3. **Guides and glossary:** `Guide` and `GlossaryTerm`.
4. **The proof band:** `Statistic`, `ClientLogo`, and the review rating. They are shared
   with the homepage. This closes the Open entry "Not editable from the dashboard yet".

A record the homepage also shows must be the same row on both pages, as the comparison is
(decision 70).

### 4. The announcement bar (Page sections)
`docs/03-page-specs.md` asks for a "dashboard-editable announcement bar". The Page sections
screen is a placeholder (decision 63).
- Build it as the `global.announcement` section:
  - text and a link;
  - on or off, with optional start and end dates;
  - audited.
- It is off until the owner writes one, so production does not change.
- It must not move layout (CLS) and must not add to the marketing routes' own script beyond
  the budget.

### 5. Forms and routing
Also a placeholder (decision 63). The enquiry types behind the contact form are live data.
- Let the dashboard edit them (`EnquiryType`): label, order, active, and where each one
  routes, as far as the schema has it.
- Every change audited.
- Show what an inactive type does to a form already on a page.

### 6. Careers and demos
- `/careers/` and `/demos/` on the `JobOpening` and `Demo` models, each with its editor.
- Until one is published:
  - the route answers 404;
  - the pages are not in the sitemap;
  - the menus stay as they are. Putting the entries back is the owner's page copy edit (see
    the Open entry on the four missing routes).

### 7. Landing pages from the dashboard (`LandingPage`)
Last in docs/12's order.
- `/lp/[campaign]` keeps its approved design. Only its content becomes editable.
- Use a field-group editor for its `content` JSON, not a textarea.
- It is its own family.

### 8. Small ones, any time between the others
- **The Lighthouse gate measures two pages** (`packages/perf/src/serve.mjs`, `PAGES`).
  - Add `/book-a-consultation/` (the Open entry says nothing keeps it at 98), `/work/`, a
    service page and an article.
  - Say in the PR how much longer CI takes.
- **`e2e/home.spec.ts` expects the services promo at `/#estimate`.** Your local database
  had `/cost-calculator/` (decision 72). Find out whether the fixture or the test is wrong,
  and fix that one. Production's menu is the owner's copy; leave it.

## Not yours — leave these alone

- **Email sending (Task 6.2).** No provider, no credentials.
- **Monitoring, Umami and cookie consent (Task 6.3).** The owner has put these off until just
  before launch. The consent banner exists to gate analytics, so it comes with Umami.
- **Off-site backups (Task 6.4).**
- **AI features.** None until the owner picks one.
- **Launch (Task 6.5)**: the domain, DNS, indexing and Search Console.
- **Writing content.** This covers:
  - the nine matrix pages and the three new cities;
  - the demo proof: client names, figures, testimonials and portraits;
  - the article block's privacy line, which still mentions a name;
  - the Northmark picture's licence.

  The owner supplies or decides all of these.
- **Calculator leads becoming subscribers.** That is a consent question for the owner (see
  Open).
- **`navy-900-invert`**, which the owner chose to leave (decision 66).
- **Design.** Decisions 72 and 73 are confirmed. Any further change to layout, tokens, copy or
  the logo is again the owner's to approve first (RULES.md, section 1).
- **Production.**
  - No deploys.
  - No `settings-cli` against production.
  - No edits in the live dashboard.

## How a PR is judged

As before:
- CI is green, including e2e, the Lighthouse gate and the own-JS budget. Decisions 72 and 73
  skipped e2e and the budget locally. Run them yourself, or wait for CI before asking for a
  review.
- You checked it at 360px and 1440px and by keyboard.
- Every decision that is not obvious from the code is in `docs/08-decisions.md`.
- The description says what changed, how you verified it, what is still open, and **what
  production needs**.

## The prompt

Once PR #33 is merged, open the repo in Claude Code on `tumit` (`git pull origin main` first)
and paste this:

> Read `RULES.md`, `CLAUDE.md`, `docs/13-collaborator-handoff.md` and
> `docs/17-next-tasks.md`, then decisions 44, 58, 59, 66, 70 and 74 in
> `docs/08-decisions.md`. For task 1, also read `docs/16-service-city-matrix.md`. I am working
> on the `tumit` branch and my next task is task N in `docs/17-next-tasks.md`. Production
> reads six content families from the database: a snapshot edit in those families does not
> reach the live site, and every new family follows the pattern in docs/17. Read the code the
> task builds on, then tell me:
> - what already exists that it should reuse;
> - what is missing;
> - anything in the docs that contradicts the code;
> - a plan in mergeable steps, with how each step will be verified (tests, 360px and 1440px,
>   keyboard).
>
> Do not write code until I have agreed the plan. Do not touch anything listed under
> "Not yours", and never write invented local content.

Replace N with the task number, starting at 1.
