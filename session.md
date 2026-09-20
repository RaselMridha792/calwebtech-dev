# Session handoff: Calwebtech platform

Last updated 2026-09-18. Written so another developer can pick up the work without the
chat history. Everything described here is merged into `main` on
https://github.com/RaselMridha792/calwebtech-dev unless a branch is named.

## Update, 2026-09-19

PRs #11 (the recovered forms family) and #12 (the VPS package) are merged; `main` built
and pushed all four images to GHCR. The old `calwebtech/` folder is deleted; the five
unrecovered booking API files are kept outside the repo in
`E:\codes\calwebtech-handoff\booking-blueprint\` with a README.

**How production gets its content (decision 43).** The owner wants the Vercel demo's
content on production, to edit later. Loading the snapshots into the database was tried
first and cannot reproduce the pages: the homepage and landing snapshots are the approved
mockups written as views, with values no mapper produces, and the snapshots disagree about
shared records. That work, the view-equality harness and the full list of differences are
on `wip/content-import-views` for the day the families move into the database.

So production launches with `CONTENT_SOURCE=snapshot`: pages render the committed
snapshots exactly as on Vercel, while leads, calculator estimates and brief drafts go to
the API and the stack's own Postgres. `node dist/import-snapshots.js`, run once by
`deploy.sh` (`IMPORT_SNAPSHOTS_ON_DEPLOY=true`), writes the few rows the forms look up:
the contact page's enquiry types and the calculator email's copy. Its acceptance test
submits a lead of every kind against a database of its own. What this leaves open is in
the Open list of `docs/08-decisions.md`: content edits still need a deploy until the
admin exists, pages stay noindex, leads carry no service or campaign link, and
`leads.notificationRecipients` must be set by hand on a new production database.

Rehearsed on this machine on 2026-09-19 with the production env example, locally built
images and Cloudflare's test Turnstile keys: `deploy.sh production local` on an empty
database migrated, imported (six enquiry types, the calculator copy), rolled out and
passed the smoke test; the homepage, a service, a case study, insights, a glossary term,
the contact page and the calculator answered 200 with the demo content and the right
canonical; a contact enquiry posted through Traefik answered 202, was stored with its
enquiry type and had its confirmation sent by the worker (log transport); a second deploy
skipped the import. Not rehearsed: Let's Encrypt, the bootstrap script, real Turnstile
keys, Resend.

Left for the owner before the first deploy (`docs/11-vps-deploy.md`): a host name
(the real domain, or a DuckDNS name), root SSH to the server, the CI's SSH key, GHCR
access for the server, Turnstile keys, and `APP_ORIGIN` on the Vercel project.

## Update, 2026-09-18

The owner's laptop SSD was replaced and the old working copy came across without its
`.git` directory. What was on GitHub was intact; what was not pushed had to be recovered
from the dead worktrees under the old `calwebtech/.claude/worktrees/`.

- **Insights, guides, glossary and the cost calculator** were already on `main` (PR #10).
- **The forms family** (`/start-a-project/`, `/free-website-audit/`) had been built to the
  contract, API, getters, copy snapshots and seed but never pushed. Recovered as PR #11
  (`recover/pages2-forms`), with the lead path merged so both the calculator's answers
  and the brief's progressive draft survive. **Its web routes and components were never
  built**: nothing renders those pages yet. That is the next content task.
- **Booking** (Task 5.1) was part built in a worktree whose `packages/` did not survive.
  Not recovered, by the owner's decision; the 900 lines of API code in the old folder are
  a blueprint for rebuilding it, nothing more.
- Do not delete the old `calwebtech/` folder until PR #11 is merged.

**Hosting on the owner's VPS** is prepared on branch `feat/vps-deploy` (decision 42,
`docs/11-vps-deploy.md`): a server bootstrap script, `production.env.example`, a manual
production deploy job with rollback, the backup sidecar the compose file had only
referenced, and the security headers middleware. The owner's answers that shaped it: the
server has 4 GB (one stack), there is no domain yet (a DuckDNS name first), backups are
deferred until a provider is chosen. The owner wants production first; production never
seeds and a fresh database answers 500 on every page, so the path is staging on the same
server first, or the snapshot importer (`What is left`, 3) before production.

The whole package was rehearsed on this machine on 2026-09-18 with Docker Desktop and
locally built images: `deploy.sh staging local` brought up the proxy, Postgres and
Redis, applied the migrations, seeded, rolled out web, api and worker on their health
checks, and passed the smoke test through Traefik (anonymous refused, five routes 200,
`X-Robots-Tag` and `Strict-Transport-Security` on every one), then recorded the tag.
Traefik loaded all three dynamic files with no errors. The four images build from a
clean tree; the backup image's `healthy` and `once` modes fail the right way without a
marker or a destination. Not rehearsed: Let's Encrypt (needs a public name), the
bootstrap script itself (needs a Linux box), a real off-site backup and the restore drill.

Toolchain on the new machine: Node 24.19 (the repo pins 22; `engines` allows it, CI and
the images stay on 22), pnpm 10.32.1, Docker Desktop with WSL 2, GitHub CLI logged in.
The Vercel demo has no `APP_ORIGIN` set, so every canonical and `og:url` there says
`http://localhost:3000`; set it in the Vercel project before anything is shared.

## Update, 2026-09-15

Live on `main` (and on Vercel) since the last handoff:

- The shared site foundation: chrome on every page, the `(site)` layout, breadcrumbs, metadata and JSON-LD helpers, `robots.txt`, `sitemap.xml`, an HTML `/sitemap/`, the `site.indexing` switch (still off, so the pages are noindex) and the page data pattern with a static snapshot fallback. Conventions live in `docs/10-site-pages.md`.
- `/services/` and ten service pages; `/industries/` and nine industry pages; `/work/` with URL filters, the case studies and `/before-and-after/` (PR #7).
- `/about/`, `/team/`, `/testimonials/`, `/awards/`, `/partners/`, `/technology/`, `/pricing/`, `/process/`, `/contact/` with routed enquiry types, `/faq/`, `/thank-you/<type>/`, the legal set, a designed not-found and error page, `/locations/` and the city pages (PR #8).
- Every page ships written content with free stock imagery and no placeholder copy. Proof reuses the approved demo proof only, and the database seed stays placeholder-only.

Still to build, in this order:

1. Insights (index, category, article), guides and glossary.
2. The cost calculator, start a project, the free website audit.
3. Booking, careers and demos.
4. `/search/` and the service-by-city pages.
5. Then the admin dashboard and auth, and hosting the API (see "What is left").

That work was being built by parallel agents, one git worktree per family, and stopped on a weekly usage limit. The branches are pushed:

| Branch | State |
|---|---|
| `pages2/insights` | part built, committed, not reviewed |
| `pages2/calculator` | part built, committed, not reviewed |
| `pages2/guides-glossary`, `pages2/forms`, `pages2/booking`, `pages2/careers-demos` | not started |
| `pages/*` | merged into `main`, safe to delete |

To continue: build each family in its own worktree from `main`, follow `docs/10-site-pages.md`, commit as you go, review, then merge into a release branch. Conflicts at the registration points (`packages/shared/src/index.ts`, `apps/api/src/app.module.ts`, `apps/web/lib/sitemap-sources.ts`, `packages/db/src/seed/pages/index.ts`) are resolved by keeping every line. Two families extending the same lead code path conflict for real: keep both sides, as `serviceSlug` and `enquiryType` were merged in `apps/api/src/leads/leads.service.ts`.

Open points from this work: the legal pages need a lawyer's review before launch; the demo proof still uses two names as both team members and client contacts; and on this machine the local Lighthouse and end-to-end stack need `PERF_API_PORT`, because port 4000 is held by another app.

## Read first

1. `CLAUDE.md`, the contract: stack, conventions, budgets, security rules.
2. `docs/08-decisions.md`, 33 decisions taken since the handoff and the **Open** list. Several
   of them override the original specs.
3. `docs/06-build-plan.md`: the task list. Status per task is below.
4. `docs/01-architecture.md` (deploy and environments) and `docs/09-performance.md`
   (budget math, how the Lighthouse gate measures).

## Where things stand

| Area | State |
|---|---|
| Code | `main` is green in CI. No open PRs. Old feature branches can be deleted. |
| Live demo | Vercel, web app only, built from `main`. Both pages render from a static content snapshot. **There is no API, database or email in the demo, so lead forms reply "could not send".** |
| Staging on a VPS | Infrastructure written and rehearsed locally, not deployed. Blocked on server access and secrets from the client. |
| Production | Not started. Needs the client's keys, DNS and server. |

## What is done

### Foundation and release gates (PRs #1, #2)
- pnpm monorepo:
  - `apps/web`: Next.js 16.3.5, React 19, Tailwind v4.
  - `apps/api`: NestJS 11.
  - `apps/worker`: BullMQ.
  - `packages/db`: Prisma 7, Postgres 17.
  - `packages/shared`: Zod schemas, the single source of types.
  - `packages/emails`: React Email.
  - `packages/config`: tokens, eslint, and the `calwebtech/teal-usage` lint rule.
  - `packages/perf`: the Lighthouse gate.
- `.github/workflows/release.yml`, on every PR and push:
  - The **verify** job runs, in order: type check, lint and build; unit tests; the 20 kB own-JS budget; migrate and seed; integration tests; the Lighthouse gate; end-to-end tests at 360px and 1440px.
  - The **build** job builds the web, api and worker images to GHCR, pushing only from `main`.
  - The **deploy** job targets staging only and is off until `DEPLOY_ENABLED` is set.
- Lighthouse gate (`pnpm lh`):
  - Runs through a local HTTP/2 edge proxy that mirrors Traefik.
  - CPU throttling is calibrated to the host, and assertions use the median of five healthy runs.
  - On a busy workstation it often ends with "host too unstable". That is by design; **CI is the gate**.
  - It switches `homepage.indexing` on for its run and restores the setting afterwards.

### Campaign landing page (Task 5.2, landing template part; PR #1)
- `/lp/[campaign]/`, one `LandingPage` record per campaign, noindex by default. Copy lives in `content` (`landingPageContentSchema`); proof comes from shared content types.
- Hero background video, from 768px up, with a poster and a pause button.

### Lead capture (PR #3)
- `POST /leads`:
  - Zod validation.
  - Cloudflare Turnstile check before anything is stored.
  - Honeypot.
  - Rate limit of 5 leads a minute per IP.
  - Contact upsert and attribution, including `referralSource`.
- A confirmation email and an internal notification go through BullMQ to Resend. `EMAIL_TRANSPORT=log` in CI and development.
- Notification recipients are the `leads.notificationRecipients` setting, changed with `node dist/settings-cli.js set ...`.

### Homepage (Task 1.2; PRs #4, #5)
- `GET /pages/home`: copy comes from the `home.content` setting, proof from content types. The view is cached for 30 seconds.
- Per-request render. Noindex until the `homepage.indexing` setting is `{"index": true}`; that flips without a redeploy.
- All sections from the approved homepage.
  - Mega menus, the mobile menu, filters and tabs are CSS or native elements. Escape closes a mega menu, and `aria-expanded` is kept in sync.
  - Sections the navigation links to show an editable empty state when they have no records.
- Own JS 7.7 kB on `/` and 7.8 kB on `/lp/[campaign]`, against the 20 kB budget.

### Staging deploy (PR #4; not on a server yet)
- One shared Traefik per server (`infra/proxy`).
- Staging and production each run `infra/docker-compose.yml` as a separate Compose project, with their own database and volumes.
- Staging adds basic auth and `X-Robots-Tag: noindex` (`infra/traefik/dynamic/access.yml`).
- `infra/scripts/deploy.sh` order: proxy, pull, migrate, optional seed, rollout, smoke test.
  - The env file gets the new tag only after the smoke test passes.
  - A failing step brings the previous release back. A failed first deploy stops the new release.
  - All of these paths were rehearsed in WSL.
- `APP_ENV` is `production`, `staging` or `development`; unset means production. A missing Turnstile key is fatal only in production.

### Seeds (PR #4)
- `pnpm db:seed` (the launch seed) is **placeholder-only**: no real names, figures, ratings or awards. It runs only with `APP_ENV=staging` or `development`. A denylist test guards it.
- `pnpm db:seed:fixtures` holds proof-shaped end-to-end data and runs only with `APP_ENV=development`.

### Vercel demo mode (decision 33; PRs #4, #5)
- With `API_INTERNAL_URL` unset, `apps/web/lib/api.ts` reads `apps/web/static-content/home.json` and `landing-b2b-website-design.json`. Both are validated by the shared schemas, and a unit test keeps them noindex.
- **The snapshots hold the owner's approved mockups word for word, by the owner's decision on 2026-09-13.** That includes demo ratings, client names, metrics, testimonials, team, prices and partner claims.
  - The landing copy comes from `reference/landing-page.html`.
  - The homepage copy comes from https://raselmridha792.github.io/calwebtech/.
  - The database seed is still placeholder-only, so CI never sees this content.
- The landing hero video is hotlinked from Pexels (video 8523640). Its poster is `apps/web/public/media/landing-hero-poster.jpg`.
- The homepage has no video: the GitHub page's `assets/*.mp4` files do not exist.

## Vercel setup (current demo)

| Setting | Value |
|---|---|
| Production branch | `main` |
| Root directory | `apps/web` (include files outside the root directory) |
| Build command | from `apps/web/vercel.json`: builds workspace dependencies, then the web app |
| Node.js | 22.x |
| Env: `APP_ENV` | `staging` for every environment. `production` without `API_INTERNAL_URL` and `TURNSTILE_SITE_KEY` stops the server by design. |
| Env: `API_INTERNAL_URL` | unset for now. Setting it switches both pages to live API data. |
| Env: `ENABLE_EXPERIMENTAL_COREPACK` | `1` (uses pnpm 10.32.1 from `packageManager`) |

## Local development

Requirements: Node 22.12 or later, pnpm 10.32.1 (via corepack), and Docker for Postgres and Redis.

```
cp .env.example .env                 # APP_ENV=development; fill the keys you have
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml --env-file .env up -d db redis
pnpm install
pnpm db:migrate                      # or pnpm db:deploy for committed migrations only
pnpm db:seed && pnpm db:seed:fixtures
pnpm dev                             # web on 3000, API on 4000
```

| Command | Purpose |
|---|---|
| `pnpm build` | type check, lint and build everything, as CI does |
| `pnpm test` / `pnpm test:integration` | unit tests; integration tests (need Postgres and Redis) |
| `pnpm --filter @calwebtech/web budget` | own client JS per route (gate 20 kB) |
| `pnpm --filter @calwebtech/web analyze /` | bytes per module for a route |
| `pnpm --filter @calwebtech/web e2e` | Playwright at 360px and 1440px. Needs a built app and a seeded database; uses ports 3000, 4000 and 3443 |
| `pnpm lh` | Lighthouse gate. Needs a built app; uses the same ports |
| `node apps/api/dist/settings-cli.js get\|set <key> ['<json>']` | read or change a setting without a redeploy. Keys: `site.contact`, `site.proof`, `leads.notificationRecipients`, `homepage.indexing`, `site.indexing` |

Notes on the machine this session used:
- Docker runs inside WSL2, so Postgres is on `127.0.0.1:55432` and Redis on `127.0.0.1:56379`.
- WSL shuts the distro down when no session is open, which takes Docker with it (symptom: ECONNREFUSED on 55432 mid-test). Keep a WSL session alive, or set `vmIdleTimeout` in `.wslconfig`.
- Other projects on the same machine compete for CPU, which is why local `pnpm lh` runs are unreliable there.

## Working agreements

- **Commits are authored only as `RaselMridha792 <raselmridha792@gmail.com>`.** No co-author or "generated with" lines. The owner adds other contributors later.
- Work on a feature branch, open a PR, and merge only when CI is green. If `gh` GraphQL calls fail, use REST (`gh api repos/RaselMridha792/calwebtech-dev/pulls ...`).
- Never relax a gate to meet a deadline. Secrets never enter the repo; `.env` is gitignored.
- Placeholder seed content stays free of invented proof. Demo content lives only in `apps/web/static-content` until it is replaced by real content.

## What is left

### Next, in the owner's stated order
1. **Host the API, worker, Postgres and Redis.**
   - The owner plans Neon for Postgres first, then Docker on the client's VPS. Neon puts lead data in a third-party database, against the data-ownership rule in `CLAUDE.md`; decision 33 records that trade-off.
   - Redis is needed for the email queue.
   - Set `API_INTERNAL_URL` on Vercel, then delete `apps/web/static-content` and its fallback in `lib/api.ts`.
2. **Before the web app on Vercel calls a public API:**
   - Forward the visitor's IP correctly. Otherwise every request arrives from Vercel's addresses, so the 5-leads-a-minute limit is shared by all visitors and Turnstile sees the wrong IP. Set `TRUST_PROXY_HOPS` to match the proxy chain.
   - Protect the API with a shared-secret header, so nobody can call it directly with a forged `X-Forwarded-For`.
   - Add an `/api/:path*` rewrite, so future admin session cookies stay same-origin.
3. **Move the demo content into the database, or replace it.** The launch seed would overwrite `home.content` and the landing page with placeholders, and `settings-cli` cannot set `home.content`. Keeping the demo copy once the API is live needs a one-off import script, not the seed.
4. **Get from the client:**
   - Turnstile keys.
   - Resend account and sending domain, with SPF, DKIM and DMARC (Task 6.2).
   - The internal notification address.
   - Server access and the staging secrets `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_KEY` and `VPS_KNOWN_HOSTS`.
   - GHCR pull access.
   - DNS: the staging A record now; apex and www only at launch.

   Then set `DEPLOY_ENABLED=true`.
5. **Real content:**
   - Replace the demo proof with verified content (`docs/06` "Content dependencies").
   - Move the hero video into our own media storage; it currently shows a third-party website on a laptop screen.
   - Flip `homepage.indexing` once the content is real.

### Site pages foundation (branch `feat/site-pages-batch-1`, 2026-09-14)

- `GET /site/chrome` and the `(site)` route group: every site page shares the homepage's header, mega menus, footer and a closing conversion band, with breadcrumbs (decisions 34 to 36).
- `site.indexing` keeps site pages noindex and `robots.txt` closed until it is switched on (decision 37).
- Metadata builder, structured data helpers, `sitemap.xml`, `/sitemap/` and a generated default preview image (decision 38).
- Six page families (services, industries, work, company, static, locations) build on it in parallel under the ownership rules in `docs/10-site-pages.md`.

### Build plan status (`docs/06-build-plan.md`)

| Task | Status |
|---|---|
| 0.1 Monorepo | Done |
| 0.2 Local infrastructure | Done (Compose with dev overrides; proxy moved to `infra/proxy`) |
| 0.3 Design tokens | Done (`packages/config/tailwind/theme.css`) |
| 0.4 Prisma schema and seed | Done; the seed is placeholder-only by decision 28 |
| 1.1 Layout shell | Partial: utility bar, header with mega menus, footer and floating CTA on the homepage. Missing: breadcrumbs, cookie consent, announcement bar, shared conversion band |
| 1.2 Homepage | Done against the placeholder database; demo content via the snapshot. The estimate band is a static preview until 4.1 |
| 1.3 Services | Not started. Homepage links to `/services/...` return 404 |
| 1.4 Metadata and schema layer | Not started (per-page metadata exists; no sitemap, `robots.txt`, `llms.txt` or structured data) |
| 1.5 Pricing, process, contact, legal | Not started. Legal links in the footers return 404 |
| 2.1 to 2.3 Work, case studies, industries, team | Not started (the API already maps projects and testimonials for the homepage) |
| 3.1, 3.2 Locations, service-by-city | Not started |
| 3.3 Before/after, awards, partners | Partial: accessible slider component; awards and partners appear only as page data |
| 4.1 Calculator | Done (PR #10). Its result panel points at `/contact/` until the booking page exists |
| 4.2 Free audit, guides, insights, glossary, FAQ | Done except the free audit page, which is the forms family (PR #11): contract, API and copy exist, the page does not |
| 4.3 Search | Not started |
| 5.1 Booking | Not started. A partial API blueprint survives in the old folder, unrecovered |
| 5.2 Start a project and landing | Partial: landing template done; the start-a-project API with progressive saving is in PR #11, the multi-step page is not built |
| 5.3 Admin dashboard, auth, RBAC | Not started. No login exists yet; settings change through `settings-cli` |
| 5.4 Campaign engine | Not started (queue and email templates exist for lead emails only) |
| 6.1 Anti-spam | Partial: Turnstile, honeypot, per-IP rate limit. Missing: timing checks, per-email limits, MX and disposable-domain checks, duplicate-lead merging |
| 6.2 Deliverability | Not started |
| 6.3 Hardening and observability | Partial: Traefik TLS config, staging auth and noindex; on `feat/vps-deploy` the server hardening (UFW, fail2ban, key-only SSH, unattended upgrades) and HSTS plus the other security headers, with a report-only CSP. Sentry, Uptime Kuma and Umami not set up |
| 6.4 Backup and restore | Built on `feat/vps-deploy` (restic sidecar, nightly, 7/4/6, restore drill script); not running until a provider is chosen. The drill into staging has not been done |
| 6.5 Launch | Not started |

### Known gaps and risks
- **Demo claims on a public URL.** The Vercel pages show demo ratings, client names, metrics, testimonials and partner claims naming Shopify, Google, Vercel and Cloudflare. They are noindex, but anyone with the link can read them. Replace before any public promotion.
- **Lost email jobs.** Emails are queued after the lead commits. If the API process dies in between, the lead is stored and its emails are never queued. A transactional outbox would close this (before Task 5.4).
- **No audit trail for settings.** `settings-cli` changes are not written to the audit log; the admin settings screen must do this.
- **Staging and production on one server.** On a single 4 GB server their memory limits overlap. Confirm the server size.
- **Lighthouse behind the real edge.** Once staging is live, run the gate against real Traefik and compare (`docs/09`, "Checking the lab against real Traefik").
- **Known demo gaps.** The newsletter box is left out (no subscriber backend). The video testimonial card has no video. Links to planned routes return 404.

## Where the code is

| Concern | Path |
|---|---|
| Pages | `apps/web/app/(marketing)/page.tsx`, `apps/web/app/(marketing)/lp/[campaign]/page.tsx` |
| Page sections | `apps/web/components/home/*`, `apps/web/components/landing/*`, shared UI in `apps/web/components/ui/*` |
| API access and static fallback | `apps/web/lib/api.ts`, `apps/web/static-content/*` |
| Lead form and server action | `apps/web/components/forms/lead-form.tsx`, `apps/web/lib/lead-actions.ts` |
| API modules | `apps/api/src/{home,landing-pages,leads,settings,turnstile,queue}` |
| Contracts | `packages/shared/src/{home-page,landing-page,lead,site}.ts` |
| Schema, migrations, seeds | `packages/db/prisma/schema.prisma`, `packages/db/src/seed/*` |
| Email templates, worker | `packages/emails`, `apps/worker` |
| Deploy | `infra/docker-compose.yml`, `infra/proxy`, `infra/traefik/dynamic` (`edge.yml`, `access.yml`, `security.yml`), `infra/scripts/{bootstrap-server,deploy,smoke}.sh`, `infra/env/{staging,production}.env.example`; the procedure in `docs/11-vps-deploy.md` |
| Backups | `infra/backup/Dockerfile`, `infra/scripts/{backup-entrypoint,restore}.sh` |
| CI | `.github/workflows/release.yml`, `.github/actions/deploy-over-ssh` |
| Tests | unit tests beside the code; end-to-end in `apps/web/e2e`; the gate in `packages/perf` |

Environment keys are documented in `.env.example` (local and API) and
`infra/env/staging.env.example` (server). The Vercel web app needs only `APP_ENV`,
`APP_ORIGIN`, `API_INTERNAL_URL` (once the API exists) and `TURNSTILE_SITE_KEY`.
