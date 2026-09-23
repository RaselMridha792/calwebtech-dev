# 08. Decisions

Decisions taken after the handoff, with the reason for each. When one changes, update
it here and in `CLAUDE.md` in the same commit.

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-09-13 | The GitHub repository is public. | Owner's decision. Nothing secret or client-confidential goes into the repo. |
| 2 | 2026-09-13 | Tailwind CSS v4. Tokens live in `packages/config/tailwind/theme.css` under `@theme`. There is no `tailwind.config.ts`. The default palette is removed, so only tokens exist as colour utilities. | Next.js 16 ships with v4. Removing the palette enforces the token rule at build time. |
| 3 | 2026-09-13 | `apps/web` never touches the database. Server components and server actions call the API. Lint enforces this with `no-restricted-imports`. | Business rules stay in one place. This resolves the conflict between `CLAUDE.md` and `docs/07`. |
| 4 | 2026-09-13 | The API owns identity, sessions and RBAC. Auth.js is dropped and there is no external auth service. The API is served on the site origin at `/api` through Traefik, which strips the prefix. Session cookies are first-party, httpOnly, Secure and `SameSite=Strict`. No CORS is configured. | Owner's decision. A single origin keeps cookies first-party and removes CORS. Business rules and access control live in one service. |
| 5 | 2026-09-13 | Pinned versions: TypeScript 5.9, ESLint 9, NestJS 11, Prisma 7.10, Vitest 4, pnpm 10.32, Next.js 16.3.5 with React 19.2.8. | The newer majors are not usable yet. `typescript-eslint` does not support TypeScript 7. NestJS 12 is ESM-only. Prisma 8 is still a release candidate. Revisit quarterly. |
| 6 | 2026-09-13 | Prisma 7 uses the `prisma-client` generator with CommonJS output and the `pg` driver adapter. The connection URL lives in `packages/db/prisma.config.ts`. | Prisma 7 requires the adapter. CommonJS matches NestJS 11. |
| 7 | 2026-09-13 | SEO fields are stored as `seo Json?` and validated by `seoSchema`, not as a Prisma composite type. | Composite types are MongoDB-only, so the original schema did not validate. |
| 8 | 2026-09-13 | Campaign landing pages are one `LandingPage` record per campaign. Campaign copy lives in `content`, validated by `landingPageContentSchema`. Proof comes from shared types. New shared types: `ProcessStep`, `PricingTier`, `ClientLogo`. | Pages publish without a deploy and without a page builder. Proof is never duplicated per campaign. |
| 9 | 2026-09-13 | Campaign pages are not prerendered at build. They render on first request and revalidate every 300 seconds. | CI builds cannot reach a production API. |
| 10 | 2026-09-13 | The campaign landing shell is 1320px with 48px gutters from `lg` (`shell-narrow`). The site shell stays at 1440px / 56px. | This matches the approved `reference/landing-page.html`. |
| 11 | 2026-09-13 | Teal is split into two tokens. `result` is only for outcome figures and affirmative marks (check icons, status dots). `--glow-teal` is only for ambient glows. Teal is banned from headings, body text, buttons, links, borders and card backgrounds. Enforced by the `calwebtech/teal-usage` lint rule. | Owner's decision. It resolves the conflict between the mockups' decorative teal and the rule that teal signals results. |
| 12 | 2026-09-13 | `pnpm lh` runs Lighthouse CI three times against the built API and web app on a seeded database and asserts on the median run. The gates are 90+ in every category, LCP under 2.5s, CLS under 0.1, Total Blocking Time under 200ms (the lab proxy for INP) and script transfer under 150KB. The page and image caches are warmed first, and the page is served over HTTP/2 + TLS through a local proxy, because `next start` only speaks HTTP/1.1. Campaign pages skip the `is-crawlable` audit because they are noindex by design. | These are the budget gates from `CLAUDE.md`, measured the way production serves the page. Traefik serves HTTP/2 over TLS. Over HTTP/1.1, simulated LCP for the same build came out about 370ms worse (2.85s against 2.48s locally), because Lighthouse's simulation models the connections it observes. Thresholds and throttling method are unchanged. |
| 13 | 2026-09-13 | The release workflow runs on pull requests too. Images are built on every run and pushed only from `main`. Deploy stays off until the repository variable `DEPLOY_ENABLED` is `true`. | CI must be green before merge. There is no VPS yet. |
| 14 | 2026-09-13 | The Lighthouse gate measures through an edge proxy (`packages/perf`), approved on three conditions. (1) The proxy reads `infra/traefik/dynamic/edge.yml`, Traefik's own TLS and compression config, and the perf tests fail on any setting it cannot mirror, so a Traefik change forces a review. (2) Once staging exists, the gate is run behind the real Traefik and compared with `pnpm --filter @calwebtech/perf compare`; divergence means the gate is fixed. (3) Lab is a proxy; the real gate is field Core Web Vitals at p75 once Umami collects them. | Owner's approval of the HTTP/2 measurement, with safeguards against the lab drifting from production. |
| 15 | 2026-09-13 | CPU throttling stays `simulate`, with the multiplier calibrated to the host: `4 × benchmarkIndex / 2400`, from the fastest of three calibration runs. Runs whose benchmark index leaves 90–110% of calibration are discarded, and assertions use the median of five healthy runs. Without five healthy runs in ten attempts the gate fails. | Lighthouse was already `simulate` with a fixed 4x, but simulation multiplies the CPU time observed on the host, so runner speed leaked in: TBT 104ms at benchmark 2431 against 268ms at 2079 in the same CI job, and locally 108ms at 2530 against 280ms at 1071 for the same build. The upper bound stops a contended calibration from making the gate lenient. |
| 16 | 2026-09-13 | A second budget: own client JavaScript per route, framework excluded, under 20 kB gzip (`pnpm --filter @calwebtech/web budget`). The 150 kB total stays. | Framework and page code no longer share one number, so framework growth from a Next.js upgrade cannot pass as page bloat. |
| 17 | 2026-09-13 | In-page links are smoothed by `AnchorScroll`, a small client component that re-reads the target's position on every frame and ends with a native hash navigation. The mockups' CSS `scroll-behavior: smooth` is removed. Cold deep links jump instantly; with reduced motion, links use the browser's instant jump. Covered by `e2e/anchors.spec.ts` at 360px and 1440px. | Keeps the approved smooth scroll on clicks. CSS smooth scrolling fixes its destination when it starts, while `content-visibility` sections change height as they render, so deep links landed 635 to 1348px off. |
| 18 | 2026-09-13 | The API verifies Turnstile before anything is stored. A missing or rejected token gets 403 `bot_check_failed` and nothing is written. When Cloudflare cannot be reached, or rejects our own secret, the lead is kept and marked `bot_check_unavailable` on its timeline, and the error is logged. The widget loads on first interaction with a form, in `interaction-only` mode. In production the web server exits at startup when `TURNSTILE_SITE_KEY` is missing (`instrumentation.ts`), so a misconfigured deploy rolls back instead of refusing every lead. Development and CI use Cloudflare's always-pass test keys; the always-fail secret is covered by the API integration tests. | A Cloudflare outage must not drop paid traffic, and a rejection must never create a record. Loading on interaction keeps third-party script out of initial JS and LCP. |
| 19 | 2026-09-13 | Lead emails go through a queue. After the lead is committed, the API adds a confirmation job and an internal notification job to BullMQ. Each job carries a snapshot of the submission and has a stable id per lead and template. The worker renders React Email templates and sends through Resend, using the job id as Resend's idempotency key, then records `email_sent` on the lead. The confirmation repeats the campaign page's own success copy, so the email promises nothing the page did not. A queue failure is recorded on the lead as `email_queue_failed`; the lead is never lost. | The request path stays fast, and retries cannot email anyone twice. Copy stays editable with the page. |
| 20 | 2026-09-13 | Email transport is `EMAIL_TRANSPORT=resend` or `log`. CI has no Resend key, runs `log`, and the worker tests use a mocked transport. Tests assert the queued payloads. Development uses Resend's test sender (`onboarding@resend.dev`) and `EMAIL_REDIRECT_TO=delivered@resend.dev`. | Owner's decision: CI never sends real mail, and the Resend account belongs to the client. |
| 21 | 2026-09-13 | The internal notification recipients are the `leads.notificationRecipients` setting, read on every lead. Until the admin settings screen exists, it is changed with `node dist/settings-cli.js set` (validated). There is no environment variable. | Owner's decision: changing the address must not need a redeploy. |
| 22 | 2026-09-13 | The worker is `apps/worker` with its own image, `GHCR_IMAGE_WORKER`. The handoff Compose file ran `dist/worker.js` from the API image. It joins `edge` for outbound access to Resend and has no Traefik labels. | This matches the repo layout in `CLAUDE.md`. The `internal` network has no route out. |
| 23 | 2026-09-13 | `node dist/migrate.js` in the API image runs `prisma migrate deploy` with the Prisma CLI shipped in the image. The config is JavaScript, generated at runtime; it reads `DATABASE_URL` from the environment and never writes it to disk. The schema and migrations are copied into the image. | Prisma 7 takes the URL only from a config file, and the image has no TypeScript or dotenv. The release workflow's migration step needed a runner. |
| 24 | 2026-09-13 | React Email components come from the `react-email` package (6.9.5), not `@react-email/components`. | `@react-email/components` 1.0.12 is marked "no longer supported" on npm; React Email's setup guide imports from `react-email`. That package also carries its preview CLI's dependencies, which are only loaded by the CLI. |
| 25 | 2026-09-13 | One shared Traefik per server, in its own Compose project (`infra/proxy`), owns ports 80 and 443. Production and staging each run `infra/docker-compose.yml` as a separate Compose project, with their own env file, database, volumes, host name and router names. Staging's env file adds basic auth (users file generated on the server) and `X-Robots-Tag: noindex` through `infra/traefik/dynamic/access.yml`. The deploy job copies `infra/` for the commit over SSH with a pinned host key and runs `infra/scripts/deploy.sh`. The new tag is written to the env file only after the smoke test passes, so a failed or interrupted deploy leaves it on the last release that went live. Any failing step, from pull to smoke test, brings that release back; a failed first deploy stops the new release. Web reaches its own API by the alias `<STACK>-api`. | Owner's decision: a staging deploy that works end to end. Two stacks on one host cannot both own ports 80 and 443, and on the shared edge network the service name `api` would resolve to both stacks' APIs. |
| 26 | 2026-09-13 | `APP_ENV` is `production`, `staging` or `development`, and unset means production. A missing Turnstile key is fatal only in production: the web server exits and the API refuses to start. Staging and development start with a warning. Without a secret the API stores submissions marked `bot_check_unavailable`. | Owner's decision: staging must deploy before the client's keys exist, while production keeps the hard stop. Defaulting to production means a misconfigured server fails closed. |
| 27 | 2026-09-13 | The homepage is noindex until the `homepage.indexing` setting says `{ "index": true }`. The seed creates it as false and never overwrites it; `settings-cli` flips it without a redeploy. | Owner's decision: keep placeholder content out of search. |
| 28 | 2026-09-13 | The launch seed holds placeholder content only, safe on a reachable URL. It has no real company, publication or person names, no invented metrics, prices, ratings, awards or client claims, and no unapproved commitments. Sections with no safe placeholder get no records and render their empty state. A unit test scans the seed for the reference mockups' invented proof. Rows from earlier seeds are removed by their known keys. The seed runs only with `APP_ENV` set to staging or development; unset is refused, because unset means production. Proof-shaped end-to-end fixtures live in a separate seed that runs only in development. | Owner's decision: the mockups' dummy data is fabricated proof, acceptable in a mockup and not on a URL someone can open. |
| 29 | 2026-09-13 | Homepage copy lives in the `home.content` setting, validated by `homePageContentSchema`. Proof comes from content types. Layout and section order are fixed by the template; there is no page builder. | Publishing without a deploy, with one source per proof type. |
| 30 | 2026-09-13 | The homepage renders per request (`force-dynamic`) from `GET /pages/home`. The API builds the view once per 30 seconds (single-flight, in-memory cache), and the endpoint skips the per-IP rate limit, because every render comes from the web server's one address. A changed record or setting is live within 30 seconds. | The CI build cannot reach the API to prerender, and `homepage.indexing` must flip without a redeploy. |
| 31 | 2026-09-13 | Sections that navigation links to always render, with an editable empty-state line when no records are published. Sections nothing links to (pull quote, whitepaper, logo band, problem router, video testimonial, press band) render nothing when empty; the capability band and mid-page CTA can be switched off in the copy. The template follows the owner's newer approved homepage (the GitHub Pages version of `reference/homepage.html`): when `hero.media` is set, photographs and the first project's figure replace the hero quote form and its `#quote` anchor. The "In the press" tab and the whitepaper and newsletter email captures are left out until subscriber capture exists; the guide links to its file, and the video testimonial shows a play button only when it has a video. Work filters and recognition tabs (shown only when expertise is published) are native radio buttons with `:has()`, so they need no script. | Owner's decision on fabricated proof. In-page anchors must land. The 20 kB own-code budget. |
| 32 | 2026-09-13 | The Lighthouse gate (`pnpm lh`, locally and in CI) switches `homepage.indexing` on for its run and puts the previous value back afterwards, also when the gate fails, so the end-to-end tests see the noindex homepage. | noindex fails `is-crawlable` by design, and the gate is not relaxed. |
| 33 | 2026-09-13 | Until the API is hosted, the web app deploys to Vercel on its own. With `API_INTERNAL_URL` unset, the homepage and the campaign landing page render from a committed snapshot of the placeholder content the API serves (`apps/web/static-content`), validated with the same schemas, and lead forms report that they cannot send. This needs `APP_ENV=staging`: production without `API_INTERNAL_URL` stops at startup. The API, worker, Postgres and Redis follow: Neon first, then the client's VPS. | Owner's decision: the client sees both pages today. The snapshot holds only placeholder content, a test keeps it on the contract and noindex, and setting `API_INTERNAL_URL` switches back to live data without a code change. |
| 34 | 2026-09-14 | Every page's chrome comes from `GET /site/chrome`, validated by `siteChromeViewSchema`. That covers the utility bar, header, mega menus, mobile menu, footer, floating call to action, the closing conversion band and `indexable`. `buildSiteChrome` in `packages/shared` builds it from the `home.content`, `site.contact`, `site.proof` and `site.indexing` settings, review sources, published service categories, services and industries, featured case studies with figures, and published locations with an address. The API caches it for 30 seconds (single flight, `common/view-cache.ts`), and the endpoint is not rate limited. The homepage renders the same components with its own header and floating calls to action, which stay on its forms (`#book`, `#estimate`). The demo snapshot `static-content/site-chrome.json` is derived from `home.json` by the same builder (`apps/web/scripts/site-chrome-snapshot.mjs`), and a test keeps the two equal. | One source for navigation on every page, editable without a deploy through the copy the homepage already uses. The builder sits in the shared package so the Vercel demo and the API cannot drift. |
| 35 | 2026-09-14 | Chrome links are site paths or absolute URLs, never bare in-page anchors (`siteHrefSchema`). Homepage anchors in the copy resolve through `HOME_SECTION_ROUTES`: `#pricing` to `/pricing/`, `#book` and `#quote` to `/contact/`, and so on. A section only the homepage has resolves to that section on the homepage (`/#estimate`, `/#insights`). `AnchorScroll` treats a link to a section of the current page written as a path like an in-page link, so those still glide and close the menus on the homepage. In the demo homepage copy (`home.json`), menu and footer links now point at the service, industry and case study pages the families build, with labels unchanged. Service and industry slugs in the snapshot now match those pages (docs/10-site-pages.md, "Links the chrome already makes"). The template's default menus, used when the copy sets none, link to the same pages. | Navigation points at real routes, while in-page anchors that only make sense on the homepage stay on the homepage. No visual change to the approved homepage. |
| 36 | 2026-09-14 | Site pages live in the route group `app/(marketing)/(site)/`. Its layout renders `SiteShell` and is `force-dynamic`: skip link, utility bar, header, `main`, the closing conversion band as a labelled region, footer, floating call to action, the Organization node, `AnchorScroll` and `RevealObserver`. Every site page has `Breadcrumbs` with a BreadcrumbList node. A page that is itself the conversion point renders `PageHasOwnForm`, which hides the band and the floating call to action with CSS (`:has()`), with no script. The HTML sitemap `/sitemap/` is the first page in the group. | Families render only content, and the frame cannot differ between pages. Pages render per request for the same reasons as decision 30: the CI build cannot reach the API, and indexing must flip without a redeploy. |
| 37 | 2026-09-14 | A `site.indexing` setting, `{ "index": boolean }`, governs every site page and `robots.txt`. The seed creates it as false and never overwrites it, and `settings-cli` sets it. Until it is true, site pages are noindex, nofollow and `robots.txt` disallows all crawling. Once true, `robots.txt` allows every crawler, naming the major AI crawlers, disallows `/api/` and points at `sitemap.xml`. `homepage.indexing` still sets the homepage's meta robots, but `robots.txt` follows `site.indexing`, so switch `site.indexing` on no later than `homepage.indexing`. The Lighthouse gate switches both on for its run and restores them, because `is-crawlable` reads `robots.txt`. | The owner's rule for the homepage (decision 27), applied to the new pages: placeholder-backed pages stay out of search, and the switch needs no redeploy. |
| 38 | 2026-09-14 | SEO helpers in `apps/web/lib/seo`. `buildMetadata`, through `sitePageMetadata`: the page title plus " \| Calwebtech" when that fits in 60 characters, otherwise the title shortened at a word; the description within 155; an absolute canonical on `APP_ORIGIN`; Open Graph and Twitter cards; robots from `site.indexing`. Pages without an image of their own use the default preview generated by `app/opengraph-image.tsx` at build time. `JsonLd` escapes `<`, `>` and `&` in record text. Builders exist for Organization, BreadcrumbList, FAQPage and Service with an Offer. `sitemap.xml` and `/sitemap/` read the registry `lib/sitemap-sources.ts`, one lazy-import line per family. | Task 1.4's layer, built once so the families apply the same length, canonical and structured data rules. |
| 39 | 2026-09-14 | Decision 33's snapshot, generalised per family. `apps/web/static-content/<family>/` holds each view exactly as the family's API returns it, with an `index.ts` keyed by slug and a test that parses each view with its schema and runs `unfinishedCopy`. Getters in `lib/api/<family>.ts` use `getView` and `findView` from `lib/api/core.ts`: the API when `API_INTERNAL_URL` is set, the validated snapshot otherwise, and null for a record that does not exist. | Families never edit a shared getter, and every page works on Vercel with no API. |
| 40 | 2026-09-14 | Where site page copy lives. Service, Industry and Location gain a nullable `content` JSON column (migration `20260914170000_page_content`), validated by the family's shared schema; null leaves those sections out. A page without a record keeps its copy in a `Setting` row keyed `<family>.<page>`. Families register placeholder seeds and end-to-end fixtures in `packages/db/src/seed/pages/index.ts` (`PAGE_SEEDS`, `PAGE_FIXTURES`), and `content.test.ts` scans every registered launch seed for invented proof. | Publishing without a deploy needs a stored place for each page's copy. An additive column loses no history, and no family edits the Prisma schema or the launch seed. |
| 41 | 2026-09-14 | Site page content rule (owner's decision), replacing older content rules. Every page ships complete, original, publish-ready copy in the approved voice, with British spelling. Imagery comes from Unsplash and Pexels, with each URL checked with curl and descriptive alt text. Proof reuses only the approved demo proof in `home.json`, `landing-b2b-website-design.json` and `reference/*.html`: narrative may be written for existing case studies, but no new figures, clients, people, awards, certifications, partnerships, ratings or guarantees. The copy lives in the static snapshots; the database seed stays placeholder-only. | Owner's decision: the demo shows complete pages while CI and staging keep running on placeholder data. |
| 42 | 2026-09-18 | The VPS package (docs/11-vps-deploy.md). `infra/scripts/bootstrap-server.sh` prepares a fresh Ubuntu 24.04 server once, as root: Docker Engine with log rotation, the key-only `deploy` user, `/srv/calwebtech`, the stack's env file from `infra/env/<stack>.env.example` with generated secrets, swap, UFW, fail2ban, sshd hardening, unattended security updates. `infra/env/production.env.example` exists beside staging's. Production deploys only by hand: `workflow_dispatch` on the release workflow with a stack and a full commit SHA on `main` (`deploy-manual`), which shares the SSH steps with the automatic staging job through `.github/actions/deploy-over-ssh`; rollback is the same job with the previous SHA, and nothing is rebuilt. The backup sidecar exists: `infra/backup/Dockerfile` (pg_dump 17 plus restic, built in CI as the fourth image), `backup-entrypoint.sh` streams a nightly dump into an encrypted off-site restic repository with 7/4/6 retention, `restore.sh` is the drill; the `ops` profile is still started by hand. Every stack opts into `security-headers@file` (`infra/traefik/dynamic/security.yml`: HSTS, nosniff, referrer policy, frame denial, permissions policy, COOP, and a report-only CSP derived from what the app loads), and the smoke test asserts HSTS when `EXPECT_HSTS` is set. | Owner's decision to host the whole platform, in Docker, on their own VPS. One 4 GB server runs one stack. Production never seeds, so a production deploy needs content in the database first; staging on the same server proves the stack meanwhile. The CSP stays report-only because Next's inline hydration scripts cannot be hashed, and nonces would make every route render dynamically. |
| 43 | 2026-09-19 | Production launches with `CONTENT_SOURCE=snapshot`. With the API reachable, the web app still renders every page from the committed snapshots in `apps/web/static-content`, exactly as the Vercel demo does, while `POST /leads`, the calculator's estimate and brief drafts go to the API and into the stack's own database (`usesSnapshots()` in `apps/web/lib/api/core.ts`; `api`, the default, is unchanged, and an unknown value stops the server). The database is prepared once by the snapshot import, not the seed: `packages/db/src/import` writes what the write paths look up (the enquiry types the contact page offers, with empty mailboxes, and the `calculator.page` copy the result email is worded from, which the page view carries verbatim) and a marker, `snapshots.import`, that makes every later run a no-op unless `--force`. `node dist/import-snapshots.js` runs it from the API image, which carries a copy of the snapshots; `deploy.sh` runs it when `IMPORT_SNAPSHOTS_ON_DEPLOY` is true and refuses a stack that also seeds. Its acceptance test creates a database of its own, migrates, imports, and submits a lead of every enquiry type, a calculator lead and a project lead through `LeadsService`. | Owner's decision: the content on the Vercel demo is what production launches with, to be edited later. Loading it into the database was tried first (branch `wip/content-import-views`) and cannot reproduce the pages. `home.json` and the landing snapshot are the approved mockups written as views, with values no mapper produces (`outcome`, the video testimonial, the press band, hardcoded alt text, orderings), and the snapshots disagree about shared records (7 against 8 client logos, 2 against 4 review sources, shortened quotes, different project summaries), so one row cannot satisfy two pages. Until the admin exists (Task 5.3) content in the database could not be edited anyway, so nothing is given up, and the data that matters, leads, is owned from the first request. Pages stay noindex, as every snapshot is. |

## 44. A family can read the database first and fall back to its snapshot

*2026-09-21.* `CONTENT_SOURCE` was all-or-nothing, so moving one family into the database
meant moving all of them — which is what stopped the first attempt (decision 43).

`CONTENT_DATABASE_FIRST` names the families that ask the API for a record and render the
committed snapshot only when the API has none. Services is the first. The effect is that a
service created in the admin is live at its own address immediately, while the ten that
were never imported keep rendering exactly as they did, and the index merges both lists so a
visitor sees one set of services rather than two.

Two sources at the same time is a transition, not a destination. A family leaves the list
when every record is in the database and `CONTENT_SOURCE=api` takes over. Until then the
editor says which addresses the snapshot is still serving, so nobody is left wondering why
a draft is not live.

This is also what makes the milestone the owner asked for reachable without first resolving
every disagreement between the snapshots: a new service needs no case study, testimonial or
technology rows, because the template omits a section it has nothing for.

## 45. A page's order of its own records belongs to the page

*2026-09-21.* Importing the ten approved service pages found two things a single column
could not hold.

**The order.** Every service page lists its stack, its industries and its case studies in
its own order: the Shopify page opens with Shopify, the WordPress page with WordPress, the
AI page with the model APIs. `Technology.order` and `Industry.order` are one number per
record, so on nine of the ten pages the approved sequence could not be reproduced — the
headline technology would have fallen into the middle of the list. `Service.content.order`
now names the slugs each section lists, in order, and the mapper sorts by it. A record the
list does not name follows the ones it does, so a technology linked in the admin appears at
the end rather than displacing the page's sequence. Ordering is presentation, and it varies
per page, which is what `content` is for; an explicit join table with an `order` column was
the alternative and can still replace this if the admin ever needs to reorder links
first-class.

**The category.** `company/technology.json` groups the stack the way the technology page
reads — data stores apart from the back end, mobile and AI together — and those group keys
are not the vocabulary a service page labels a technology with. Writing the group key into
`Technology.category` would have dropped the label from nineteen technologies, including
PostgreSQL's "Back end" and Shopify's "Ecommerce". The category now comes from whichever
service page lists the technology, and `TECHNOLOGY_CATEGORY_LABELS` moved to
`packages/shared` so the mapper and the import cannot disagree about it. A technology no
service page lists takes its category from its group, and one whose group maps to nothing
stops the import rather than getting a category nobody chose.

Where the two snapshots spell one name differently — `headless CMS` against `Headless CMS`,
`vector search` against `Vector search` — the row takes the service page's spelling, so no
approved service page changes. The technology page keeps its own until it moves, and either
is editable in the admin. Worth settling in the snapshots.
## 46. The site is being rebuilt on the 2026 brand

*2026-09-22.* The owner had a full design system drawn — cream ground, navy core,
champagne accent, full-bleed photographic plates, Archivo display type — and asked for it
to be implemented. It replaces the white-and-cobalt palette the site was built on, and
with it the two approved mockups in `reference/`: those record the design this supersedes.
The words do not change. The owner's instruction was that the content stays exactly as it
is and only the dressing moves, so no copy is rewritten by this work.

The tokens are added beside the old ones rather than in place of them, because the
dashboard is built on `primary`, `result`, `danger` and the whole `--color-admin-*` set,
and because 88 marketing components cannot move in one commit. The old tokens go family by
family as each one is redressed; the admin keeps its own for good, including its faces —
Archivo's tracking is drawn for a 112px headline, not a 13px table row, so
`[data-theme='admin']` resolves `--font-display` and `--font-sans` back to the pair the
dashboard was designed in, the same way it already resolves two colours.

The logo arrived with the system. It is outlined paths with no live text, so the wordmark
is never re-typed in a web font, and there is a file per ground rather than one file
recoloured by CSS: champagne is 1.8:1 on cream, so the light lockups carry a deeper
`gold-600` that the type palette has no use for.

`next/image` was the first thing tried for it and the budget refused it: the component
costs about 12 kB of client runtime, the mark is in the header of every page, and initial
JavaScript went from 139.9 kB to 152.1 kB against a 150 kB gate — for a vector the
optimiser cannot improve. It is a plain `img` with its intrinsic size, which is 0 kB and
shifts nothing.

The five plates the system ships are **generated placeholders, not licensed photography**.
They fix the grade, the crop and the contrast floor; real commissioned shots at the same
crop and duotone are needed before launch. The system's own `assets/plates/README.md`
briefs each one.

## 47. Booking is its own page, and the system never arranges the meeting

*2026-09-23.* The owner's client was concerned about booking, so it came forward from the
rest of task 5.1. The button in the header used to scroll to a band on the homepage; it now
goes to `/book-a-consultation/`, a page whose whole content is which times are free. There
is no snapshot fallback and there never will be: a free slot is a fact about the database
this second, and a cached list offers times nobody can book. Without the API the page says
there are no times rather than showing any.

**No meeting link is generated anywhere.** The owner was explicit: a person sends a Google
Meet invitation by hand. So nothing integrates with a calendar, no `.ics` is attached yet,
and both emails promise only what actually happens — the confirmation says nothing is
scheduled automatically, and a test asserts it never mentions a calendar invitation.

Slots are generated server-side from the consultation type, its weekly hours and the
minimum notice, and a submitted time is checked against a freshly generated list rather
than against the one the browser was sent. Two people wanting the same hour is settled by
`@@unique([consultationTypeId, startsAt])`, not by reading before writing: the API inserts
and turns Prisma's `P2002` into "that time has gone". The integration test starts both
bookings before either finishes, which is the case a check-then-insert implementation
passes in a test and fails in production.

The visitor's timezone is theirs, not ours. The API sends instants; the page groups them
into days by the visitor's own clock, because a Friday evening in Los Angeles is Saturday
lunchtime in Sydney and belongs under Saturday for that reader. `Intl.DateTimeFormat`
does all of it — a date library is most of a route's 20 kB own-code budget on its own.

Two traps this cost a while, both worth writing down:

- `TURNSTILE_FIELD` was imported into the booking's server action from the `'use client'`
  module that renders the widget. On the server that import is not a string but a reference
  to the client module, so `form.get()` matched nothing, the token arrived empty and the
  visitor was told their own booking looked automated. The name now lives in
  `apps/web/lib/turnstile-field.ts`, which has no directive, and every reader imports it
  from there instead of writing it out.
- The admin's status panel is a client component and imported two constants from the
  package barrel, which carried the whole of Zod into the browser: 134.8 kB of own code on
  `/admin/bookings/[id]` against a 20 kB gate. The statuses moved to their own Zod-free
  module with a `@calwebtech/shared/booking-status` subpath, beside `./slugify`, and the
  route is back to 5.4 kB.

## Open

- The approved demo proof gives two names two identities. "Priya Raman" is Calwebtech's
  Design Lead on the landing page and Truvia Labs' VP Marketing in a testimonial. "Dana
  Whitfield" is Calwebtech's Delivery Manager and Halloway Group's Operations Lead. Several
  portrait photos are reused between a client and a team member. The owner decides which
  identity stays; until then no site page shows both (docs/10-site-pages.md).
- The approved menus linked to four routes that did not exist. `/guides/` and `/glossary/`
  were built (PR #10). `/careers/` and `/demos/` were not, so on 2026-09-21 those three
  entries were taken out of the chrome and homepage snapshots rather than left pointing at
  a 404 on a live site. Put them back when the careers and demos pages are built; the
  `JobOpening` and `Demo` models are already in the schema.

- The cost calculator's result depends on the booking page. `CONSULTATION_PATH`
  (`/book-a-consultation/`) is the booking family's contract: `calculatorBookingPath`
  carries the eight answers to it, and both the result panel's next action and the emailed
  copy's button use it. That route does not exist until Task 5.1, so the calculator's
  closing call to action points at `/contact/` for now, as the site chrome does. Task 5.1
  must land before a visitor is sent through the result panel in production, and the
  booking page must read the `?source=cost-calculator&project-type=...` parameters back
  with `calculatorAnswersFromSearchParams`, or the answers are carried for nothing.

- The landing hero video is Pexels stock footage (video 8523640, 1280×720, 3.3 MB),
  loaded from `videos.pexels.com`. Move it to our own media storage with the media library,
  and replace it once the client has footage of their own. Its poster is
  `apps/web/public/media/landing-hero-poster.jpg`.
- The web app runs on Vercel with the static snapshot and no API (decision 33). Lead forms
  cannot send until the API is hosted. Hosting the API on Neon puts lead data in a
  third-party database, against the data-ownership rule in `CLAUDE.md`; the owner has
  chosen that as a step before the client's VPS. Remove `apps/web/static-content` once the
  API is live everywhere the web app runs.

- `DEPLOY_ENABLED` stays off until the staging environment's secrets (`VPS_HOST`,
  `VPS_PORT`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`) and GHCR pull access exist.
  Switching it on earlier fails every push to `main`. The bootstrap script prints them.
- The owner's server has 4 GB, which runs one stack. Staging and production side by side
  need 8 GB or a second server.
- Content is still edited by changing a snapshot and deploying (decision 43). Families move
  into the database one at a time once the admin exists (Task 5.3). Each needs its mapper
  extended or its snapshot corrected where the two disagree, and an owner's decision for
  every conflict between snapshots; `wip/content-import-views` has the importers for proof,
  the homepage and the landing page, the view-equality harness, and the list of differences
  in its commit message. `CONTENT_SOURCE=api` on production before that answers 500 on
  every page, because the database has no `home.content`.
- With `CONTENT_SOURCE=snapshot`, a lead from a service page or a campaign is stored without
  its service or landing page link, because those rows do not exist, and its confirmation
  email uses the default acknowledgement instead of the page's own success copy. The
  calculator's result email is complete. Indexing cannot be switched on: every snapshot is
  noindex and a test keeps it so, which is right while the proof is invented.
- `leads.notificationRecipients` is unset on a new production database, so a lead is stored
  and nobody is told. Set it with `settings-cli` before taking enquiries
  (docs/11-vps-deploy.md, Step 5).
- The owner has no domain yet. Let's Encrypt needs a name, so the first host is a free
  DuckDNS name (on the Public Suffix List; `sslip.io` and `nip.io` are not, and share one
  rate limit with everyone). The real domain is a `SITE_HOST` change and a redeploy.
- Of the `ops` Compose profile, `backup` is deployable and started by hand once the env
  file has a restic destination (the owner deferred the choice of provider); Umami still
  needs its own database (Task 6.3). A deploy does not move `backup` to the new tag.
- The `media` volume is mounted only by `backup`; the API does not write uploads there
  until the media library exists (Task 5.3), so that snapshot is empty for now.
- Every container reads the one stack env file, so the backup credentials are visible to
  web, api and worker too. A separate ops env file would be tighter.
- The client confirms the internal notification address. Until then the seed sets
  Resend's test inbox (`delivered+leads@resend.dev`).
- The client's Resend account, sending domain, SPF, DKIM and DMARC (Task 6.2). Until
  then development uses `EMAIL_TRANSPORT=log` or Resend's test sender.
- Emails are queued after the lead commits. If the API process dies between the commit and
  the enqueue, the lead is stored but its emails are not queued, and nothing marks it. A
  transactional outbox would close that gap. Revisit before campaign sends (Task 5.4).
- Settings changed with `settings-cli` are not written to the audit log yet. The admin
  settings screen (Task 5.3) must write the audit entry.
- Of task 5.1, what is built is: consultation types, weekly hours and date overrides edited
  from `/admin/bookings/availability`, minimum notice, the horizon, server-side slots, the
  visitor's timezone, the double-booking constraint, the confirmation and internal
  notification emails, and the dashboard's list, detail, status and notes. Still to build:
  the `.ics` invite, reminders at 24h and 1h, and signed reschedule and cancel link pages.
  The build plan's gate for 5.1 names reminders, reschedule and cancel, so 5.1 is not
  closed.
- Production books in `America/Los_Angeles`, and that is the owner's choice, asked and
  answered on 2026-09-23: the calls are taken in US West Coast hours. Every availability
  rule is written in that zone, so `/admin/bookings/availability` reads as Pacific, and a
  visitor in Dhaka is offered 2:30 AM. That is the intended offer, not a bug to fix. The
  setting is `booking.page`'s `timeZone`, changeable with settings-cli if the answer ever
  changes.
- The booking page's own copy is the `booking.page` setting, and like `home.content` it is
  not one of the five settings the admin screen exposes, so it changes with `settings-cli`
  until the content manager reaches singleton pages (Task 5.3). The hours, which change
  far more often, are editable from `/admin/bookings/availability`.
- The availability screen edits the one active consultation type. A second type would need
  a chooser there and a type per booking link; nothing depends on that yet.
- The Lighthouse gate runs against `/` and `/lp/[campaign]` only (docs/09). The booking
  page was measured by hand at 98/100/100/100 with LCP 2.1s; nothing keeps it there.
