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

## 48. Every page opens on a photograph

*2026-09-23.* The owner found the inner pages' flat navy heroes plain and asked for a
relevant photograph behind every one. Two things were in the way, and only one of them was
missing images.

`PageHero` already took a `backdrop`, and a dozen page families already passed one — but it
was drawn at a quarter opacity under two near-opaque navy gradients, so the photograph was
downloaded, preloaded as the LCP element and then hidden. The hero now draws a plate the way
the homepage does: the photograph at full strength under one `scrim-strong` across the whole
of it, which holds inverted ink above the 7.8:1 the brand asks for wherever the words fall.
An edge gradient cannot promise that.

The pages with no record to carry an image — contact, the FAQ, the legal pages, the
sitemap, thank-you, the glossary and guides indexes, the booking page — take one from
`apps/web/lib/hero-backdrops.ts`. Every photograph there is one the site already serves:
already chosen, already under the Unsplash License, already known to resolve. An invented id
would answer 404, and on the LCP element that costs the page its largest paint as well as
its picture. A case study uses its own cover, an article its own cover.

Six pages had been light on purpose — contact, the FAQ, an article, the sitemap, thank-you
and the legal pages — so they would never get a transparent bar. They are plates now, which
meant their hero children, drawn for cream, had to be checked one by one: the article's
byline and the FAQ's topic label were navy on the photograph, and the contact and thank-you
cards let unstyled lines inherit the hero's inverted ink, cream on their own cream ground.
The article's cover is its plate now rather than a second copy beside the heading.

Two header faults were fixed with it, both the same mistake — a colour that belonged to the
bar reaching things that sit on another ground. The navy wordmark was navy on the navy hero,
so a cream lockup now takes its place there, lazy so a page without a dark hero never
fetches it. The mega menu panels and the small-screen menu inherited the bar's inverted ink
on their own cream ground; anything inside a `[data-panel]` is now left out of the bar's
rules. The hamburger was navy on navy the other way round, because the rule only named links
and buttons and it is a `summary`.

Photographs remain the owner's placeholder choice until commissioned ones replace them; the
licence for each is recorded by the fact that it is an Unsplash photograph (see Open).

## 49. Subscribers, segments and the suppression list in the dashboard

*2026-09-23.* The first part of Task 5.4. The schema already had `Subscriber`,
`SubscriberTag`, `Segment` and `Suppression`, so no migration was needed. The contract is
`packages/shared/src/audience.ts`, the API is `apps/api/src/admin/audience/`, and the
screens are `/admin/subscribers/`, `/admin/subscribers/[id]/`, `/admin/subscribers/segments/`
(with a builder at `segments/[id]/`, `new` to create) and `/admin/subscribers/suppression/`.
All of it sits under the `subscribers` module, so the RBAC matrix is unchanged.

- **A segment is a rule tree stored in `Segment.rules`** (`segmentRulesSchema`): match all
  or any of up to 20 conditions on tag, signup page, email domain, time since joining and
  time since last engaged. Dates are relative ("in the last 30 days"), because the rules are
  evaluated again at send time, and "last month" has to mean the month before the send.
  No conditions means everyone who may be mailed.
- **Suppression and unsubscribes are applied on top of every segment**, not left to the
  rules (`eligibleWhere`). No rule set can reach a suppressed or unsubscribed address. The
  builder's live count, the list's counts and, later, the send all go through
  `AdminAudienceService.audienceWhere`, so the count shown is the count a send reaches.
- **Suppressed means the address is on `Suppression`**, compared without case, and it wins
  over subscription state in the subscriber's status.
- **The dashboard can add an address to the suppression list, as `manual`, and cannot
  remove one.** Bounces, complaints and unsubscribes arrive from the provider and from the
  person. Taking an address off the list is left out until the owner decides who may do it.
- **The dashboard creates no subscribers and deletes none.** A subscriber is somebody who
  gave consent on the site; deleting one loses the record of that consent.
- A segment that a campaign uses cannot be deleted (409, `segment_in_use`).
- New audit actions: `subscriber.tags_changed`, `suppression.added`, `segment.created`,
  `segment.updated`, `segment.deleted`.

## 50. Campaign composer, templates, tokens, preview and test send

*2026-09-24.* The second part of Task 5.4. Contract in `packages/shared/src/campaigns.ts`,
templates in `packages/emails/src/campaign.tsx`, API in `apps/api/src/admin/campaigns/`,
screens at `/admin/campaigns/` and `/admin/campaigns/[id]/` (`new` to create). No migration:
`Campaign` already had every column.

- **The body is blocks, not HTML** (`campaignBodySchema`): heading, paragraph, button and
  divider, stored in `Campaign.body`. The template decides how each looks, so nobody writes
  markup and every campaign stays on brand. A button links only to an `http(s)` address.
- **Two branded templates**, `letter` and `announcement` (`Campaign.templateKey`). They are
  code in `packages/emails`, reviewed like any other component; the dashboard only chooses
  one. `announcement` lifts the first heading onto a dark band. Email colours stay the ones
  in `packages/emails/src/tokens.ts`.
- **Personalisation tokens**: `{{name}}`, `{{firstName}}` and `{{email}}`, with a fallback
  after a bar, `{{firstName|there}}`. `personalise` in the shared package is the one
  function that fills them, for the preview, the test and the send. A token nothing can
  fill is refused when the campaign is saved rather than sent as braces.
- **Only a draft can be edited or deleted** (409, `campaign_locked`). A scheduled campaign is
  what will be sent and a sent one is the record of what was.
- **The preview renders unsaved content** through the API (`POST /admin/campaigns/preview`)
  with the same template as the send, filled from the newest subscriber the chosen segment
  reaches, or a placeholder without one. The dashboard shows it in a sandboxed frame.
- **A test send is a job on the email queue** (`campaign-test` in `emailJobSchema`), to at
  most five addresses, with the subject marked `[Test]` and the tokens filled from the
  person who asked. It goes out as the campaign is saved, so the button waits until there
  are no unsaved changes. Each request has its own `testId`, so two tests are two emails and
  a retried one is still one. It is audited (`campaign.test_sent`), throttled to six a
  minute, and writes no delivery row: the report counts only the people a campaign was sent
  to.
- The API now depends on `@calwebtech/emails` to render the preview. It is a workspace
  package, and the API image's `--filter "@calwebtech/api..."` build already includes it.
- New audit actions: `campaign.created`, `campaign.updated`, `campaign.deleted`,
  `campaign.test_sent`.

## 51. Scheduling, the send and unsubscribing

*2026-09-24.* The third part of Task 5.4. Migration `20260924033859_campaign_recipient_failure`
adds `failedAt` and `error` to `CampaignRecipient`: a recipient not sent to for good, and why.
Additive, nothing lost.

- **Scheduling** (`POST /admin/campaigns/:id/schedule`, `sendAt` or null for now;
  `POST .../unschedule` back to a draft). Only a draft with a segment can be scheduled, and a
  time more than a minute in the past is refused rather than read as now. Audited as
  `campaign.scheduled` and `campaign.unscheduled`.
- **The worker starts a campaign, not the API** (decision 22: the API only produces). A sweep
  on its own queue, `campaign-sweep`, runs every minute and when a campaign is sent now. It
  moves a due campaign from SCHEDULED to SENDING in one conditional update, so it starts once;
  evaluates the segment **at that moment**; writes a delivery row per person; then queues them.
- **Rows before jobs.** A recipient's row is written before its job, and each sweep requeues
  every recipient of a sending campaign not yet sent to. A process that dies in between loses
  nobody. For campaigns this closes the outbox gap noted in Open for lead emails.
- **One job per recipient** on the `campaign` queue, with the job id and the provider
  idempotency key `campaign-send-<recipientId>`, so a retry or a requeue never sends twice. A
  recipient already sent to is skipped.
- **Rate**: a BullMQ limiter of `CAMPAIGN_SEND_PER_SECOND` (default 1) across every worker.
  Resend's default is 2 a second for the whole account, and lead and booking emails share it.
  Sends go one by one, not through Resend's batch endpoint, so each recipient has its own
  provider id and its own idempotency key.
- **Suppression is checked again at send time**, per recipient. Somebody who unsubscribes or
  bounces during a long send is not sent to by it: the row is marked `failedAt` with
  `suppressed` or `unsubscribed`. This is the rule that no campaign overrides the list.
- **Finishing**: a sending campaign with nobody left is SENT, or FAILED if nobody received
  it. The worker audits `campaign.dispatched`, `campaign.sent` and `campaign.failed` with no
  user, because no user did it.
- **Unsubscribe links.** Every campaign email carries its recipient's own link,
  `/unsubscribe/<token>/`, and the RFC 8058 headers `List-Unsubscribe` (the API's
  `/api/unsubscribe/<token>`) and `List-Unsubscribe-Post`. The token is the subscriber id, a
  tilde and an HMAC of the id (`@calwebtech/shared/unsubscribe-token`), keyed from
  `AUTH_SECRET` with a purpose label; it never expires. A tilde, because Next treats a last
  segment with a dot as a file and would redirect every link once.
- **Unsubscribing** sets `Subscriber.unsubscribedAt` and adds the address to `Suppression`
  as `unsubscribe`, in one transaction, and is idempotent. Opening the page changes nothing;
  its button does, so a link scanner cannot unsubscribe anybody. The page is noindex and
  has no client script. Audited as `subscriber.unsubscribed`.
- **No link, no send.** Without an `AUTH_SECRET` of 16 characters or more, or without
  `APP_ORIGIN`, the API refuses to schedule and the worker starts nothing, logging why. It
  never sends a campaign email without a working unsubscribe link.
- The screen polls every 15 seconds while a campaign is scheduled or sending, so the counts
  move without a reload.

## 52. Delivery events and the campaign report

*2026-09-24.* The last part of Task 5.4. No migration: `WebhookLog`, `EmailEvent` and the
recipient's event columns were already in the schema.

- **The webhook is `POST /api/webhooks/resend`**, public and signed. Resend signs with Svix
  (`svix-id`, `svix-timestamp`, `svix-signature`, secret `whsec_…`); the check is written with
  `node:crypto` in `apps/api/src/webhooks/svix-signature.ts` rather than taken from the
  `svix` package, which would be a new supplier. A timestamp more than five minutes from now
  is refused, so a captured request cannot be replayed. The API keeps the raw body for this
  (`NestFactory.create(..., { rawBody: true })`); nothing else changes.
- **`RESEND_WEBHOOK_SECRET`** is a new optional key. Unset, the webhook answers 503 and no
  event is recorded; sending is unaffected. Subscribe the webhook in Resend to
  `email.delivered`, `email.opened`, `email.clicked`, `email.bounced` and `email.complained`;
  anything else is logged and ignored.
- **Stored first, applied second.** Every signed request is written to `WebhookLog` with its
  `svix-id` before it is applied, so a failure can be replayed. A request whose `svix-id` is
  already stored is acknowledged and not applied again, because Resend retries with the same
  id. A failure is recorded on the log row and still answered 200.
- **Applying** writes an `EmailEvent` for any email we sent, stamps the campaign recipient's
  event column the first time only, sets the subscriber's `lastEngagedAt` on an open or click
  (what the segment builder's "last engaged" rule reads), and puts the address on the
  suppression list on a permanent bounce (`hard_bounce`) or a complaint (`complaint`),
  whichever email it was. A bounce Resend marks `Transient` is recorded, not suppressed.
  This also delivers Task 6.2's "bounce and complaint webhooks moving addresses to
  suppression".
- **The report** is `/admin/campaigns/[id]/report/` (`GET /admin/campaigns/:id/report`),
  counted in people, not events. Each count includes the ones past it: an open counts as a
  delivery, a click as an open. Opens are a floor, and the screen says so. "Unsubscribed" is
  recipients whose unsubscribe came after the campaign started. The recipient list shows each
  person once, at the furthest thing that happened, with a bounce or complaint above the rest
  (`campaign-report.ts`); its filters use the same rule, so a list and its labels agree.
- The report, like every list in the dashboard, is state in the URL with no client script.

## 53. "Subscribe now" on the homepage is where subscribers come from

*2026-09-24.* The owner's answer to the question decision 49 left open. The homepage carries a
"Subscribe now" band above the footer: a call to action that takes one thing, an email
address. That is the campaign engine's first source of `Subscriber` rows; until it, the
audience builder had no audience.

- **One field.** No name, no company, nothing else asked of the visitor. `Subscriber.name`
  stays empty, and the personalisation tokens fall back (`{{firstName|there}}`), which is what
  the fallback syntax is for.
- **Its own endpoint, not the lead flow.** `POST /subscribers` (`apps/api/src/subscribers/`,
  contract in `packages/shared/src/subscribe.ts`) writes a `Subscriber` and a `Contact`. The
  insights article's newsletter block used to store a `RESOURCE` lead; since decision 55 it
  posts here too, with the article's path as the source page.
- **The answer is always the same.** A new address, one already subscribed, one that
  unsubscribed and one on the suppression list all get `subscribed`. A public form that
  answered differently would tell a stranger whether somebody else's address is on a list.
- **Suppression is never lifted from the form.** It is unauthenticated and sends nothing to
  confirm the address, so anyone can type anyone's address into it. If that could re-enable an
  address that had unsubscribed, bounced or complained, a stranger could undo a person's
  request to be left alone. Such an address is left exactly as it is; only the owner decides
  who may lift a suppression (decision 49). Nothing already stored is overwritten either: the
  first consent time, address and source page stay the record.
- **Protected like every public form:** Turnstile, a honeypot under the lead forms' field name
  (`referenceCode`), five a minute per visitor address, and one row per address, settled by
  the unique constraint when two arrive together.
- **The words are homepage content.** `content.subscribe` in the homepage snapshot, with a
  default in the schema so a `home.content` stored before the band existed still parses.
  The success line says "You are on the list" and not "check your inbox": no confirmation
  email is sent, so it would not be true.
- **The source page is stored** (`/` for the homepage), so a segment can address the people
  who subscribed there (decision 49's `sourcePage` rule).

**What this does not do, and the owner should know.** It is a single opt-in. Nothing confirms
that the address belongs to the person who typed it, so somebody can subscribe another
person's address. Turnstile and the rate limit make that costly at scale, and every campaign
carries a working unsubscribe link, but the right fix is a confirmation email (double
opt-in), which needs email to be sending. Production sends none today (`EMAIL_TRANSPORT=log`,
no Resend account), so this should be done before the first real campaign goes out, not
after.

## 54. The owner's revision of 2026-09-22, and no scroll reveal

*2026-09-24.* The owner's written revision (a PDF dated 22/09) and the footer details sent
with it. What it changed, in one place:

- **Technology moved into Resources.** The bar carries no plain links any more; the
  Resources menu gained a Technology column — the overview and its six parts, each an
  anchor on `/technology/` (`#frontend` to `#mobile-and-ai`, `scroll-mt-28` so the fixed
  header does not cover the heading). The menu lays four lists out in two-column spans when
  a promo shares the panel, and the home content allows four resource columns.
- **A booked call lands on `/thank-you/booking/`**, titled "Thank you for booking a
  consultation with us.", and repeats the booked time back from the address (`?at=` and
  `?tz=`: the instant and the visitor's zone, nothing about who booked it, since a
  thank-you URL ends up in histories and referrers). The page's promises were corrected to
  what happens: no calendar invite and no reschedule link are sent today.
- **Industries in the owner's order:** Hotels and resorts (the renamed Hospitality),
  Real estate, Spa centres, Media, Law, Healthcare, then the rest as they were. Spa centres,
  Media and Law are new pages written for this — **their copy, including its statements
  about HIPAA, lawyer-advertising rules and subscription law, is Calwebtech's draft and the
  owner has not reviewed it**. Review it before the next deploy.
- **Contact:** the telephone number is off the site until there is one to publish
  (`siteContactSchema.phone` and `phoneE164` are nullable together, and every place that
  showed a number leaves it out), and the mailbox is `calidigi62@gmail.com`. The footer
  shows "California / United States", the owner's own words, through the collaborator's
  `footer.offices` and `footer.contactEmail` (see Open): the two of us built the footer
  change separately on the same day, and the merge kept that design rather than a second
  field doing the same job. The snapshots carry it; **production's `site.contact` setting
  still has the old values and must be changed with settings-cli after the deploy**, or lead
  emails and the API's views keep the demo number.
- **"The pages load, then change" — the scroll reveal is gone.** Sections faded in as they
  scrolled into view, but the fade was gated on script: an inline script hid every
  `[data-reveal]` element until the React bundle had hydrated and an IntersectionObserver
  ran, so a slow connection saw blank sections for up to three seconds and then everything
  at once. A CSS view-timeline replacement was tried and refused by the anchor tests: it
  forces layout of sections `content-visibility: auto` had skipped, so `/#services` landed
  hundreds of pixels away. Content present at first paint beats a fade, so nothing is hidden
  and nothing animates in. `reveal()` still marks elements and nothing styles them. The rest
  of the slowness is distance — the server answers in 30–60 ms, the round trip from Dhaka is
  about 290 ms — which a CDN in front of the real domain would address, not code.

## 55. The article's subscribe block creates a subscriber

*2026-09-25.* Task 1 of `docs/14-remaining-work.md`. The inline block in every insights
article posted a `RESOURCE` lead through the lead flow, so nobody who subscribed from an
article reached the campaign engine.

- **One path for subscribing.** The block's form now posts through the homepage's server
  action (`components/subscribe/actions.ts`, `subscribeToNewsletter`) to `POST /subscribers`,
  with the article's path (`/insights/<slug>/`) as `sourcePage`. Everything decision 53
  promises holds for it: the same answer for every address, suppression never lifted,
  Turnstile, the honeypot and the rate limit. `components/insights/subscribe-action.ts`, the
  lead-flow copy of that path, is gone.
- **An address and nothing else.** The name field is removed, and so is the hidden
  `attribution` field: the subscriber contract has neither. `nameLabel` left
  `insightsNewsletterCopySchema`, the eight article snapshots, the seed and the API test
  fixtures. A stored `insights.copy` that still has it parses, because Zod drops unknown keys.
  `INSIGHTS_NEWSLETTER_FORM_ID`, which named the lead, went with the action.
- **What changes for the owner:** a subscription from an article no longer appears in the
  leads inbox and no longer sends a confirmation email (a subscriber gets none, decision 53).
  It appears under Subscribers, and a segment can select it with the "signed up on" rule
  (a page containing `/insights/`).
- **The copy stays in the `insights.copy` setting**, as before. Its `success` comment no longer
  says the words are repeated in an email.
- **Found while checking 360px:** in every article the body column was 514px wide on a
  360px screen, because a grid item is as wide as its widest content and each article's table
  set it; the section's `overflow-hidden` then cut the text and the subscribe block off at the
  right edge. `min-w-0` on the column fixes it (`components/insights/article-page.tsx`); the
  tables scroll inside their own wrappers, as they were built to.
- Checked in Chrome at 360, 768 and 1440 (one input, no horizontal overflow, the column
  312px at 360 on all eight articles) and by keyboard: Tab from the field reaches the button,
  a bad address puts focus back on the field with `aria-invalid` and keeps what was typed, and
  a good one moves focus to the success line. A subscription from
  `/insights/core-web-vitals-in-plain-english/` stored that path and created no lead.

## 56. The start a project page

*2026-09-25.* Task 2 of `docs/14-remaining-work.md` (build plan task 5.2). `/start-a-project/`
answered 404: the contract (`packages/shared/src/pages/forms.ts`), the API's page view and
progressive saving (`apps/api/src/forms/`), the getter (`lib/api/forms.ts`) and the copy
snapshot came back in PR #11, and the page was never built. It is built on them unchanged.

- **Six steps, one question each**, in the contract's order: project type, contact, services,
  budget, timeline, the brief in the visitor's words (`FORMS_PROJECT_STEPS`). Only a name and
  an email are required, as the copy promises.
- **The booking form's pattern (decision 47).** Every step is in the DOM and only the current
  one is shown; a step's own fields are checked with `reportValidity()` before it hides; focus
  moves to the new step's question; Turnstile runs once, on the send. The form is `noValidate`:
  with native validation on, pressing Next made the browser check the required fields of the
  hidden contact step and refuse to submit at all. The option lists (`LEAD_PROJECT_TYPES`,
  `BUDGET_BANDS`, `START_TIMELINES`) are passed in as props, so the client component imports
  only types from the shared barrel.
- **Abandonment is measurable per step, the build plan's gate.** From the contact step on,
  each move forward saves the brief through a server action (`components/forms-pages/actions.ts`)
  to the existing `POST /forms/project-draft`, with the step reached. That writes the
  `PROJECT` lead on the first save (`draft_started`) and a `draft_saved` activity with the
  step on each later one; the send goes through the site's lead action with the draft's id and
  token and completes the same lead (`form_submitted`), so one brief is one row. A brief left
  on step five is a lead whose draft step is 5. The saves run one after another so each reads
  the draft the one before created, never block the visitor, and the page says "Saved" only
  when the API returned a draft.
- **The lead mapper reads the brief's fields.** `lib/lead-form.ts` never read `projectType`,
  `projectLinks`, `draftId` or `draftToken`, although the shared contract had them; it does
  now. That file is on docs/10's foundation list; the change was needed for the task.
- **Where the family's components live.** docs/10 puts a family's components in
  `components/<family>/`, but `components/forms/` is the foundation's (`LeadForm`,
  `use-turnstile`), so this family's are in `components/forms-pages/`.
- The page: hero with the answer block, the brief with the page's assurances beside it, what
  happens next, what a quote needs, the other ways in, and the questions as FAQPage. Grounds
  alternate white and tint. The closing conversion band is hidden: the page is the form.
- **Verified.** Unit tests (`forms-pages.test.tsx`, `lib/lead-form.test.ts`) and
  `e2e/forms.spec.ts`, run against the dev stack at 360 and 1440 (7 passed, the send skipped
  on mobile for the rate limit). In Chrome at 360, 768 and 1440: one `h1`, no horizontal
  overflow, the lower sections rendered. By keyboard: Space picks an answer, Tab reaches Next,
  Enter moves on and focus lands on the new question; an empty name keeps the contact step
  with focus on the field. A sent brief was one `PROJECT` lead with `draft_started:3,
  draft_saved:4…6, form_submitted` and landed on `/thank-you/project/`; an abandoned one
  stayed a lead at draft step 5. The route's own client JavaScript is 8.1 kB of the 20 kB budget.

## 57. The free website audit page

*2026-09-25.* Task 3 of `docs/14-remaining-work.md`. `/free-website-audit/` answered 404
although its contract, API view (`GET /pages/free-website-audit`), getter and copy snapshot
came back in PR #11. The page is built on them unchanged.

- **One step, one lead.** The site, what worries the visitor about it (one of
  `LEAD_AUDIT_CONCERNS`), a competitor to compare against, a name, an email, a company and a
  note. Only the site, the name and the email are required. It posts as an `AUDIT` lead through
  the site's lead action, so the API's Turnstile, honeypot, rate limit, storage and emails
  handle it as they handle every form. The browser checks the required fields on send, then
  Turnstile runs once; the action is dispatched by hand so a refused send keeps what was typed.
  A sent request lands on `/thank-you/audit/`, which already existed.
- **The lead mapper reads the audit's fields.** `lib/lead-form.ts` never read `mainConcern`
  or `competitorUrl`, although the shared contract had them; it does now, and the lead stores
  them in `answers`. Same foundation file as decision 56, changed for the same reason.
- **The two forms share their controls.** The labelled input, textarea and choice list moved
  out of the brief into `components/forms-pages/fields.tsx`, with an id prefix so the two
  forms never share an id.
- **Fields side by side stay level.** At 1440 the competitor's label ("… (optional)") wraps
  to two lines and pushed its input below the site address's. Each field now spans three rows
  of its grid (label, control, note) with `subgrid`, and the label sits on its input, so a
  longer label moves its neighbour's input down with it. The brief's contact step had the same
  grid and gets the same fix.
- **The menus now open the page.** The Resources menu and the footer's resources linked "Free
  website audit" to `/contact/` while the page did not exist; they link to
  `/free-website-audit/` in the site chrome and homepage snapshots. The contact form keeps
  its own "Free website audit" topic, and the start a project page's "Ask for a free website
  audit" alternative now resolves.
- The page: hero with the answer block, the request with the page's assurances beside it,
  what the audit covers (rows on hairlines), how it arrives (timed steps beside the page's
  picture), what it is not, and the questions as FAQPage. Grounds alternate white and tint.
  The closing conversion band is hidden: the page is the form.
- **Verified.** Unit tests (`forms-pages.test.tsx`, 7 new) and `e2e/forms.spec.ts` (3 new),
  run against the dev stack at 360 and 1440: 10 passed, the two sends skipped on mobile for
  the rate limit. In Chrome at 360, 768 and 1440: one `h1`, no horizontal overflow, the inputs
  of each row on the same pixel at 768 and 1440 and stacked at 360, the delivery picture
  loaded. By keyboard: Tab runs site, competitor, the concerns, name, email, company, note,
  send; an empty send puts focus on the site address. A sent request was one `AUDIT` lead
  with `answers {"mainConcern":"slow-on-mobile","competitorUrl":"https://rival.com"}`. The
  route's own client JavaScript is 7.2 kB of the 20 kB budget.

## 58. Industries and case studies are edited in the admin, and can read the database first

*2026-09-25.* Task 4 of `docs/14-remaining-work.md`, first part. Non-negotiable 3 says publishing
never needs a deploy, and industries and case studies still did. Both now work the way services
do (decision 44). They have their own importer families, an equality test against the snapshots,
a database-first getter, and admin screens to add, edit, publish, unpublish and remove.

- **Three new importer families, appended to the registry.** A live database that ran the older
  families runs only these on its next deploy.
  - `industries` writes the index copy, each page's copy into `Industry.content`, the card image,
    the SEO and the FAQs.
  - `case-studies` writes the `work.copy` setting, with headings stored using the `{client}`
    token. For each project it adds the platforms, the segment (read from the card's tags), the
    gallery with alt text and the order of its services.
  - `page-copy` is decision 59.

  Copy already stored, whether written by the family before or edited in the admin since, is
  left alone even on a forced run.
- **The pages built from the imported rows are the approved ones.** `industries-import` and
  `work-import` check this section by section. The only exceptions are named in the tests:
  - **Card tags and alt text.** Same as the service pages.
  - **The work proof band.** Its figures and rating are the homepage's too, and the snapshots
    disagree about them (decision 43). The web app keeps the snapshot's band until the database
    has figures.
  - **"headless CMS" versus "Headless CMS".** The technology row takes the service pages'
    spelling (decision 45).
  - **A related service's summary.** A case study describes each service in its own words; the
    row holds one summary, the one on the services index.
- **A page's own order, again (decision 45).** One relation links a service and an industry, read
  from both sides. The approved pages disagree about it on all twelve industries:
  - a service page lists the sectors it serves best;
  - an industry page lists the services a buyer in that sector needs.

  An industry page now lists the services its copy names, in that order (`matchedServices`).
  Case studies list their services in their own order too, kept in the new `Project.content`
  column (migration `20260925130000_project_content`). `/work/` lists featured case studies
  first, then the most recently changed. Every approved case study carries the same date, so the
  import stamps them a second apart in the approved order. **Saving a case study moves it to the
  top of /work/**; Featured is how to keep one first.
- **Removal keeps the row.** Industry gains `deletedAt` (migration
  `20260925120000_industry_deleted_at`), as Service and Project have. For both editors:
  - a removed record keeps its slug, so nothing else can inherit its redirect;
  - a published address that moves leaves a 301 to the new address;
  - a published address that is removed leaves a 301 to its index;
  - every change is audited: `industry.*` and `case_study.*`.
- **Case studies publish only when their page can render.** That means three outcome figures
  and an answer block (`caseStudyReadiness`). The API refuses to publish otherwise and gives the
  reason. A link to a service, platform or industry that does not exist is refused, not dropped.
- **Editing copy without editing JSON.** `components/admin/content/copy-editor.tsx` renders a
  page's copy as fields, following the page's schema:
  - a line or text area for each piece of copy;
  - a named group for each section;
  - lists that can be added to, reordered and trimmed;
  - each API error shown under the field whose path it names.

  A section can be added or left out only where the page describes its shape
  (`INDUSTRY_CONTENT_SHAPES`, `CASE_STUDY_SHAPES`), so the editor never invents structure. The
  service editor's controls moved to `editor-parts.tsx` so all the editors share them.
- **Switching it on.** Add `industries` and `work` to `CONTENT_DATABASE_FIRST`, and only after the
  deploy's import has run those families on that database. `/before-and-after/` keeps its
  snapshot, because its approved comparison describes its screenshots in words no row holds.
- **Verified.**
  - Tests:
    - unit tests for the mapper, getters and copy editor;
    - integration tests for the import equality, both admin services end to end with their
      audit entries, and the whole API suite (149).
  - In Chrome at 360 and 1440:
    - both lists and both editors have no overflow, no console errors, and every control
      labelled;
    - an industry title and a case study summary changed in the editor reached
      `/industries/healthcare/` and `/work/` with the families read from the database first;
    - emptied copy was refused with the reason under the field.
  - Own JavaScript on the new admin routes is 3.4 to 9.6 kB of the 20 kB budget. The public
    routes did not change.

## 59. Page copy is edited in the admin and audited

*2026-09-25.* Task 4, second part. Some page copy belongs to no record, and only `settings-cli`
on the server could change it. That tool writes no audit entry. The copy in question:

- the homepage (`home.content`);
- the booking page (`booking.page`);
- the thank-you pages (`static.thank-you`);
- the copy around the services, industries and work indexes.

- **The six rows and the screen.**
  - `PAGE_COPY_KEYS` lists the six rows, each with the schema its page reads it with.
  - `/admin/page-copy/` lists them. Each opens in the copy editor.
  - The API checks the whole value with the page's own schema before storing it, and refuses it
    with each refused field's path.
  - Every change is audited as `page_copy.updated`, with the sections it touched. Sections are
    compared regardless of the order Postgres keeps keys in.
- **The copy had to be stored first.** The launch never wrote `home.content` or
  `static.thank-you` (decision 43). The `page-copy` family writes them from the snapshots, only
  where no row exists. The thank-you copy is read back out of its seven pages. A test builds each
  thank-you page from the stored copy and checks that it equals its snapshot.
- **The site lays the stored copy over the snapshot.** This applies while pages render from
  snapshots and `home` or `thank-you` is in `CONTENT_DATABASE_FIRST`. `GET /pages/copy/:key`
  serves the two stored copies, and the web app uses them as follows:
  - **The homepage** takes its words from the database and keeps its records from the snapshot.
  - **The header, menus, footer and closing band** of every page are rebuilt from those words
    with `buildSiteChrome`. Built from the snapshots alone, that rebuild is byte for byte the
    committed chrome.
  - **Each thank-you page** is built from the stored copy. A type the copy lacks keeps its
    snapshot, so a form never sends anyone to a page that went missing.

  With the approved copy stored, every page equals the committed one. The booking page reads
  its copy from the database already.
- **Verified.**
  - Tests:
    - integration tests: import, refusal by path, audit, served copy, and edits kept by a forced
      import;
    - web unit tests: an unchanged site with the approved copy stored, the edited words
      reaching the homepage and the chrome, and a thank-you type the copy lacks keeping its
      snapshot.
  - In Chrome at 360 and 1440:
    - the homepage copy opens as 451 labelled fields, with no overflow and no console errors;
    - a hero heading and a footer address changed in the screen reached the homepage and the
      footer of `/pricing/`, and were put back.

## 60. Reminders, a calendar entry, and moving or cancelling a call

*2026-09-25.* Task 5 of `docs/14-remaining-work.md`, the rest of build plan task 5.1. All of it
works with `EMAIL_TRANSPORT=log`, so no provider was added (Task 6.2).

- **A calendar entry, never a meeting link.** The emails that carry an iCalendar file
  (`packages/emails/src/invite.ts`):
  - the confirmation, with the time;
  - a moved call's email, with the new time;
  - a cancelled call's email, with the entry's cancellation.

  The UID stays with the booking and SEQUENCE only grows, so a calendar updates the entry it
  holds instead of adding another. The organiser is the site's contact address when one is set.
  The entry states that the meeting link comes from a person. Decision 47 stands: the system
  arranges no meeting.
- **Reminders a day and an hour before.** These are delayed jobs on the email queue, one per
  window. Their ids name the booking, the window and the call's time. Moving a call removes its
  old reminders and queues new ones. Cancelling it removes them, whether the visitor cancels from
  the link or the team cancels or closes it in the dashboard. A reminder whose time has already
  passed is not queued. **Before sending, the worker reads the booking again** and skips a call
  that was cancelled, moved to another time or deleted. That covers a removal that could not
  happen, such as a job already being sent or Redis briefly unavailable. A sent reminder is
  written on the booking's timeline as `reminded_24h` or `reminded_1h`, the names the schema
  gives them.
- **The signed links.** Every booking already stored two random 192-bit tokens. They are now
  links in the confirmation and the reminders:
  - `/book-a-consultation/reschedule/<token>/` moves the call;
  - `/book-a-consultation/cancel/<token>/` cancels it.

  Each token allows only its own action. The other link's token, or one that names nothing,
  answers 404. Both pages are noindex, send no referrer (the address is the credential) and hide
  the closing band.
- **Moving follows the same rules as booking.** The new time must be one the engine offers now,
  and the database's unique index settles two people choosing it at once. The call keeps its
  tokens, becomes `RESCHEDULED`, and gets a `rescheduled` event with both times. The visitor and
  the team are each emailed.
- **Cancelling is idempotent.** A second cancel answers the same way as the first. A call whose
  time has passed can neither move nor cancel.
- **A cancelled call gives its time back.** This fixes a bug found while building the feature:
  the unique index on `(consultationTypeId, startsAt)` kept a cancelled call's row holding its
  slot. The slot was offered to the next visitor, and booking it failed. The index is now on
  `slotStartsAt`, the time a call holds while it is on: null once it is cancelled, so the
  database still refuses two calls at one time (migration
  `20260925150000_booking_slot_released_on_cancel`, which fills the column for every call that
  is not cancelled). Bringing a cancelled call back in the dashboard over a time booked since is
  refused.
- **The booking page's calendar became `SlotPicker`,** with no change to its markup or behaviour,
  so the move page offers the same one. Its weekday headings were keyed by their narrow names,
  and two days share "T" and two share "S". That filled the console with duplicate-key errors on
  every visit to `/book-a-consultation/`. They are keyed by the full name now.
- **Verified.**
  - Unit tests: the calendar file, the four email templates and their links, the worker's
    reminder check, and the pages.
  - Integration tests:
    - reminders delayed at both windows;
    - each link allowing its own action only;
    - a refused and then a successful move, with its reminders replaced and both sides told;
    - a cancel freeing the time for somebody else;
    - the dashboard's cancel removing the reminders;
    - the whole API suite (156) and the worker's (5).
  - The booking e2e suite at 360 and 1440.
  - In Chrome at 360 and 1440:
    - both pages have one `h1`, no overflow and no console errors;
    - a call booked on the site was moved by keyboard, with focus landing on the review, and
      then cancelled;
    - the log transport recorded the confirmation, the moved and cancelled emails with
      `calwebtech-call.ics`, and the team's three notifications.
  - Own JavaScript is 6.9 kB on the move page and 4.3 kB on the cancel page. The booking page is
    unchanged at 8.4 kB.

## 61. Anti-spam beyond Turnstile and the honeypot

*2026-09-25.* Task 6 of `docs/14-remaining-work.md` (build plan task 6.1). One guard in the API
(`apps/api/src/antispam/`) sits in front of leads, bookings and subscriptions alike. The numbers
and the throwaway-inbox list live in the shared contract (`packages/shared/src/antispam.ts`).
Every failure of the machinery itself — Redis away, DNS slow — lets the submission through,
because losing a real enquiry costs more than the spam the check stops.

- **Timing.** `FormClock` is a hidden field in every form. It times the form from when it
  appears, using `performance.now()` so a wrong clock changes nothing. The API refuses a form
  sent sooner than its minimum: two seconds for a lead or a booking, one for a subscription.
  The refusal is a failed bot check, so a person who really was that quick is told to try
  again and their retry goes through. A form without the figure, loaded before the field
  existed or sent without script, is not timed.

  The calculator's gate carries no clock. It appears after eight answers, where an autofilled
  name and email could be quicker than the minimum.
- **Addresses.** A throwaway inbox provider, from a short list matched on whole labels, is
  refused with a message under the email field. So is a domain that cannot receive mail. The
  API asks DNS for the domain's mail servers and falls back to its address records, as a
  sending server would, and refuses only a domain that does not exist or has neither. A null
  MX is let through: it exists, and a mistyped domain is what the check is for. Answers are
  cached for six hours. `EMAIL_DOMAIN_CHECK=off` skips the lookup alone.
- **Per-address limits.** These sit on top of the per-IP ones:
  - five leads an hour;
  - three bookings a day;
  - five subscriptions an hour.

  They are counted in Redis under a hash, so no address is stored there. Counting happens
  after the bot check, so a script cannot spend a real person's allowance. Past the limit a
  lead or a booking answers 429. A subscription is answered as always and writes nothing,
  since subscribing twice changes nothing (decision 53).
- **Duplicates join what is already there.**
  - **Leads.** A lead from the same address, of the same type, updates the open lead instead
    of creating a second. The open lead is one from new to proposal sent, created within
    thirty days, with a form actually sent. The update writes what the new submission says,
    adds its services and records `form_resubmitted` with its message. Its emails carry the
    submission's id so they are sent, and the team's notification reads "Lead updated".

    An unfinished brief is never joined, and a won or lost lead starts a new one. The
    Contact was already one per address; a subscriber was already one per address.
  - **Bookings.** An address with a call still to come cannot book a second. The page names
    that call's time and points at the link in its email that moves it (decision 60).
- **Found while checking in Chrome.** The clock's hidden input first carried `defaultValue=""`.
  A hidden input's value is its default, so React cleared the figure on the render every form
  does when it shows it is sending, and the API never saw it. The field has no value prop now.
- **Verified.**
  - Unit tests: the DNS check (a domain with mail servers, one with only an address, one that
    does not exist, a failure and a timeout passing, the cache and its expiry), the guard and
    the contract.
  - An integration test through the three services:
    - a resubmission merged, with emails of its own;
    - another type and a closed lead starting anew;
    - a form sent in 200 ms refused with nothing stored;
    - a throwaway inbox and an undeliverable domain named under the field;
    - the lead limit ending in 429;
    - a subscriber past the limit answered as always;
    - a second booking refused with the first one's time;
    - the whole API suite (163).
  - In Chrome:
    - an audit sent at once was refused as automated and went through on a retry;
    - a second audit from the same address became one lead with `form_resubmitted`;
    - a mailinator address was named under the homepage field at 360;
    - a second booking from one address was refused with the first call's time.
  - The e2e specs that send forms pause as a person would (`e2e/pause.ts`). The clock adds
    about 0.2 kB to a form's route.

## 62. llms.txt and site search

*2026-09-25.* Task 7 of `docs/14-remaining-work.md`: build plan tasks 1.4 (its last piece) and
4.3.

- **`/llms.txt`** follows the format llmstxt.org proposes: a title, then a one-line summary,
  then sections of links with a line each. It is built per request from the pages' own words:
  - the summary is the homepage's description;
  - then the footer's line about the company, the service area, the offices and the contact
    address;
  - then every published service and industry with its own summary;
  - then the key pages, and optional ones such as insights, the glossary and the sitemap.

  Nothing in it is written separately, so it cannot drift from the pages or claim what they do
  not. While `site.indexing` is off it answers 404, as robots.txt disallows everything then.
- **Site search** covers the five kinds the page spec names: services, case studies, insights,
  glossary terms and questions. Results are typed, and filtered by kind with a count for each.
  - **In Postgres, with no vendor.** `GET /search` uses Postgres's own full-text engine, weights
    the title above the text and reads the query with `websearch_to_tsquery`, so quotes, `or`
    and a minus work as people type them. It finds only what has a page:
    - live services and posts;
    - case studies with the figures their page needs;
    - published terms;
    - questions on the FAQ page or on a live service, industry or location page.

    The tables are small enough to need no index: a three-word query answers in well under
    300 ms against the imported content, the build plan's gate. If the content grows into
    thousands of rows, add GIN indexes on the same expressions.
  - **From the snapshots while pages render from them.** In the launch mode (decision 43) the
    database does not hold what the visitor reads, the articles and the glossary above all, so
    the web app searches the same five kinds in the snapshots. Every word must match, and a word
    in a title counts three times one in the text. The answer has the same shape, so the page
    cannot tell which engine answered. A record created in the dashboard is found once pages
    read the API; until then the snapshot search covers the snapshots' content.
  - **`/search/`**: a photograph hero, a labelled GET form, the filter as links, and results as
    rows on hairlines that name their kind first. It has no script, 3.2 kB of own JavaScript
    (the framework's floor), is never indexed and is not in the sitemap. Nothing links to it yet
    except a query that sends someone there. A search link in the header or footer is the
    owner's copy (`home.content`), editable from the page copy screen (decision 59).
- **Not built: the service-by-city matrix** (task 3.2). docs/14 says to ask the owner whether
  it is still wanted, and this pass asks nothing, so it waits for that answer.
- **Verified.**
  - Tests:
    - unit tests for the file's format, the contract, the snapshot search and the page;
    - an integration test of the Postgres search: a service found by its name first, drafts
      left out, a case study found by its client, the filter keeping every count, and the
      300 ms gate;
    - the whole API suite (167).
  - In Chrome at 360 and 1440, `/search/` has one `h1`, is noindex, has no overflow and no
    console errors. A query was typed and sent by keyboard, and the Questions filter was
    followed by keyboard.

## 63. The dashboard is rebuilt: one visual system, an overview, and search

*2026-09-26.* The collaborator found the dashboard flat and hard to read — navy on navy, 9px
labels, every screen laid out its own way, and an overview that was still a placeholder — and
asked for it to be rebuilt as a modern, interactive tool a non-coder can use, as polished as
the public site, with nothing it does taken away. Before building, a dozen admin products were
looked at (Linear, Vercel, Stripe, Resend, Supabase, Attio, Payload, Sanity, Strapi, Shopify
Polaris, Tailwind Catalyst, shadcn and Tremor), along with the dashboard guidance from Nielsen
Norman Group and Smashing Magazine. A design was drawn first on a Claude Design canvas
(https://claude.ai/artifact/6PQPCodDy9Sz39HjLExZq2, private to the owner's account), then
built.

- **No token was added or changed.** RULES.md, section 1 puts tokens with the owner, so the
  rebuild uses only what `theme.css` already has:
  - the admin's navy steps for surfaces;
  - the brand's cream (`ink-invert`, `ink-invert-muted`) for text, where the old screens used
    the cooler `admin-ink` and `admin-body`;
  - the brand's champagne on a dark ground for the one primary action per screen. That is the
    same gold-on-navy button as the homepage hero (`bg-gold-500 text-on-gold`), and the rule
    the teal lint cites allows it.

  Gold also marks the current place (the active menu item, the current tab) and the small
  eyebrow over each title. Teal stays on round dots and bold figures, as the lint allows. A
  light theme would need light values for `result` and `danger` inside the admin, which is a
  token decision, so it was not built (see Open).
- **One kit, `apps/web/components/admin/ui/`.**
  - `styles.ts` holds class strings for cards, controls, buttons, pills, tags and tables:
    - controls are 40px, and 44px on a touch screen (RULES.md, section 7);
    - labels sit above fields at 13px, not in 9px capitals;
    - body text is 14px.
  - `page.tsx` has the frame every screen uses: `AdminPage`, `PageHeader`, `Panel`,
    `EmptyState`, `LinkTabs`, `ChipLinks`, `Facts` and `BackLink`.
  - `charts.tsx` draws stat cards, sparklines and daily bars as SVG on the server, because a
    chart library would be most of a route's own-code budget.

  The kit's column is `#admin-main`, not `#main`: the marketing layout pads `#main` for its
  fixed header, and that padding showed up as a gap above every admin title.
- **The shell.**
  - The sidebar carries the real logo instead of a typed wordmark, as CLAUDE.md requires.
  - The Dashboard item no longer lights up on every screen. It matched every path by prefix.
  - Settings moved into the Site group.
  - The sidebar narrows to a rail of icons. A cookie remembers it, so a reload draws the page
    the way it was left.
  - The user menu at its foot holds sign-out, and keeps the keyboard contract RULES.md sets:
    Escape closes it and focus returns to its button.
  - The top bar has a real breadcrumb, a "View site" link, and **search or jump to**, opened
    with Ctrl K or ⌘K. It lists:
    - every screen the role can open;
    - the "New …" actions the role can take;
    - a search of leads or subscribers for the words typed.

    It is a native `<dialog>`, loaded only when first opened, so no screen pays for it
    beforehand.
  - A skip link comes first in the tab order. Browser controls are dark
    (`color-scheme: dark`). The focus ring is the admin's own focus tone, because cobalt did
    not show on navy.
- **The overview is built** (docs/12, screen 1). `GET /admin/overview` answers in one read,
  and a section is null when the role cannot open its module, so the API decides what each
  role's first screen shows. It carries:
  - leads this week and this month, each against the period before;
  - thirty days of daily counts in the business timezone;
  - where leads stand, and where they came from;
  - the latest five leads, with no addresses, since a viewer reads this screen too;
  - the next calls, the audience, the last campaign's delivery, open and click rates;
  - recently edited content, and scheduled services past their time.

  The page greets by the business's clock and says in one sentence what is waiting. It lists
  what needs attention, each item linked to where it is dealt with: overdue follow-ups, new
  leads with no owner, unpublished pages, draft campaigns, and a site still hidden from
  search engines. It is tested against the imported content and leads placed at known ages.
- **The leads inbox.**
  - Status tabs with counts. Choosing Won or Lost brings closed leads into the counts, or
    theirs would read zero.
  - Filters are pills with their labels inside them.
  - While a lead is open, the table drops its secondary columns.
  - The panel leads with the pipeline and offers "Email" and "Call".
  - The page scrolls as one, with the table's header row sticking. At first the table
    scrolled in a box of its own, and a short window squeezed it to two rows (the
    collaborator caught it).
- **Every other screen** — bookings and availability, subscribers, segments and suppression,
  campaigns, the composer and the report, services, industries, case studies and page copy,
  media, team, settings, the audit log, the two placeholders, and sign-in — moved onto the
  same frame. Each one follows one of two patterns:
  - **Listings:** a header with the count and the one primary action, then link tabs or filter
    chips, then rows in a card. The whole row is clickable, carries its state as a pill with a
    dot, and has a real empty state.
  - **Editors:** the fields in cards on the left, with a plain line of help for each group.
    Publishing, save, delete and the search result sit in a column on the right that stays
    in view as the page scrolls.

  A few things were added in passing:
  - The bookings list pages; it used to stop at twenty-five.
  - The bookings list and a booking's record read times on the business's clock.
  - The media library gets a search box. The page already read the parameter.
  - A segment's field errors are shown as words.
  - Sign-in shows the logo, and the typed wordmark component is deleted.

  Copy that only explained the machinery ("committed snapshot", "CONTENT_DATABASE_FIRST") now
  says what a visitor sees, and where a server setting has to change it still names it. No
  string a test asserts was changed except two in `copy-editor.test.tsx`, which followed its
  groups from `fieldset`/`legend` to headed sections.

  Moving between screens shows a skeleton at once (`(shell)/loading.tsx`). A leads filter is
  a client-side navigation through Next's `Form`, so it no longer reloads the page.
- **Verified.**
  - Every admin screen, 35 routes, at 360, 768 and 1440 in Chrome: no horizontal overflow,
    exactly one `h1` and one `main`, and no console errors. The full lead record had no `h1`
    before this pass either; it has one now.
  - By keyboard:
    - the skip link is the first stop;
    - Ctrl K opens the palette with focus in its combobox, the arrows and Enter go to a screen,
      and Escape closes it;
    - the rail survives a reload;
    - the user menu and the phone drawer close on Escape and hand focus back.
  - Own JavaScript per route stays under the 20 kB gate: 5.9 to 13.2 kB on admin routes, up
    from 3.4 to 9.6 kB. Every marketing route's figures are byte for byte what they were.
  - Tests: web 465, API 260, shared 259, plus the overview's integration test. Lint and type
    checks are clean.

## Open

- **Nothing reports abandonment yet.** The drop-off per step is in the data (each draft lead's
  step and its `draft_*` activities) but no screen counts it; the leads inbox shows an
  unfinished brief as an ordinary new lead. A small report in the dashboard, or a filter for
  unfinished briefs, would make the gate visible to the owner.
- **The floating "Start a project" button goes to `/book-a-consultation/`**, not to this page
  (`floatingCta` in the homepage copy). That is the owner's content, so it was left.

- **The article block's privacy line still mentions a name.** `insights.copy`'s
  `newsletter.privacyNote` reads "Your name and email are stored in our own database…", and
  the block no longer asks for a name (decision 55). The words are the owner's (RULES.md,
  section 1), so they were left; the owner may want "Your email is stored…".

- **The footer's office and contact are set in the homepage copy**, not taken from the
  locations and the site contact (2026-09-24, at the collaborator's request). `home.content`'s
  `footer.offices` and `footer.contactEmail` are optional: empty, the footer falls back to the
  published locations with an address and to `contact.email`, as before. The snapshot sets one
  office, "California" / "United States" — the owner's words, with no street address, since
  the owner gave none — and `calidigi62@gmail.com` as the footer's only contact. The
  telephone number is off the whole site, not only the footer (decision 54). The homepage's
  locations section still lists the published locations; if the owner wants a street address
  shown, it goes in `footer.offices`.

- **Northmark Supply's image is not stock photography.** On 2026-09-24 the case study's
  picture was replaced, at the collaborator's request, by an image supplied as a file
  (`apps/web/public/media/northmark-supply.jpg`, 1536×1024, served through the Next image
  optimiser) on the homepage, `/work/`, the case study's cover and Open Graph image, and every
  related card except one. Decision 41 says imagery comes from Unsplash and Pexels, with each
  URL checked; this file's origin and licence are not recorded. The insights snapshot test
  enforces that rule, so the Northmark card inside the insight "b2b-ecommerce-what-a-stock-
  theme-cannot-do" still shows the old Unsplash photo. The owner decides: keep the new image
  (record its licence, allow `/media/` in `insights.test.ts`, and update that card), or
  return to a stock photograph everywhere.

- Staging sits behind basic auth (`infra/traefik/dynamic/access.yml`), which covers `/api`
  too, so Resend cannot reach `/api/webhooks/resend` there and a one-click unsubscribe from a
  staging email is refused. Production has no basic auth. If staging needs delivery events,
  exempt those two paths from the basic-auth middleware.

- The homepage's "Subscribe now" creates subscribers (decision 53), and since decision 55 so
  does the insights article's block. Still open: calculator leads who consented are not
  subscribers, and no import exists. And the form is single opt-in, so a
  confirmation email should come before the first real campaign; it needs email to be
  sending, which production does not do today.

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
- **Turning the database-first families on in production is the owner's step.** Services,
  industries, case studies (`work`), the homepage copy (`home`) and the thank-you copy
  (`thank-you`) can each read the database first (decisions 44, 58 and 59). Each needs the
  deploy's import to have run its family on that database first, then its name in
  `CONTENT_DATABASE_FIRST`; production names `services` alone today. Until a family is named,
  what the dashboard saves for it is stored and audited but the site keeps its snapshot, and the
  page copy screen says so beside each row.
- **The dashboard has one theme, the dark one** (decision 63). A light theme would need light
  values for `result` and `danger` inside `[data-theme='admin']`, which is a token decision for
  the owner (RULES.md, section 1).
- **Page sections and Forms and routing are still placeholders** (decision 63 restyled them,
  nothing more). The enquiry types behind the contact form are live data that a Forms screen
  could edit.
- **The service-by-city matrix (task 3.2) is not built** and waits for the owner to say whether
  it is still wanted (docs/14, task 7). The locations index and the two city pages are live.
- **Nothing links to `/search/` yet** (decision 62). A search link in the header or footer is a
  change to the homepage copy, the owner's to make from the page copy screen.
- **The antispam figures are first guesses** (decision 61): two seconds before a lead or a
  booking, five leads an hour and three bookings a day per address. Once the site takes real
  enquiries, the `form_resubmitted` and refused-submission patterns will say whether they are
  right; they live in `packages/shared/src/antispam.ts`.
- **Saving a case study moves it to the top of /work/**, which lists featured first and then the
  most recently changed (decision 58). The approved order was stamped in at import; mark the case
  studies that must stay first as Featured.
- **Not editable from the dashboard yet:** a case study's quote and video testimonial (their own
  records), the proof band's figures and rating (shared with the homepage), and
  `/before-and-after/`, which keeps its snapshot.
- **In the dashboard's sidebar, Dashboard is marked as the current page on every screen**,
  because its link (`/admin/`) is the start of every other one (`components/admin/sidebar.tsx`,
  `isCurrent`). Seen while checking task 4; left as it was.
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
  transactional outbox would close that gap. Campaign sends do not have it (decision 51:
  rows first, requeued by the sweep); lead and booking emails still do.
- Settings changed with `settings-cli` are not written to the audit log yet. The admin
  settings screen (Task 5.3) must write the audit entry.
- Task 5.1 is complete on `tumit` (decision 60): the `.ics` entry, the 24h and 1h reminders
  and the signed reschedule and cancel pages were the last of it. None of the booking emails
  reaches anyone until production sends email (Task 6.2); until then the reminders are
  queued, checked and logged like every other email.
- **The booking emails carry the move and cancel links only where `APP_ORIGIN` is set on the
  worker**, since the job holds paths and never a host. Without it they fall back to "reply to
  this email", as before.
- Production books in `America/Los_Angeles`, and that is the owner's choice, asked and
  answered on 2026-09-23: the calls are taken in US West Coast hours. Every availability
  rule is written in that zone, so `/admin/bookings/availability` reads as Pacific, and a
  visitor in Dhaka is offered 2:30 AM. That is the intended offer, not a bug to fix. The
  setting is `booking.page`'s `timeZone`, changeable with settings-cli if the answer ever
  changes.
- The booking page's own copy is the `booking.page` setting. Since decision 59 it is edited
  from `/admin/page-copy/` with the homepage and thank-you copy, and audited; the hours, which
  change far more often, are editable from `/admin/bookings/availability`.
- The availability screen edits the one active consultation type. A second type would need
  a chooser there and a type per booking link; nothing depends on that yet.
- The Lighthouse gate runs against `/` and `/lp/[campaign]` only (docs/09). The booking
  page was measured by hand at 98/100/100/100 with LCP 2.1s; nothing keeps it there.
