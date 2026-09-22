# Calwebtech Platform

You are building the Calwebtech agency website: a custom, self-hosted marketing and
acquisition platform. This file is the contract. Read it fully before the first task.

## What this is

> **`RULES.md` is the normative source.** This file restates it for agents working in the
> repository. Where the two disagree, `RULES.md` wins and this file is the bug. Read
> `RULES.md` section 1 before changing anything about the design, the stack or the content.


A Next.js marketing site plus an authenticated admin dashboard, backed by a separate
Node API, PostgreSQL and Redis, all running in Docker on a client-owned VPS.

It replaces three things the business currently rents: a page builder, a third-party
form vendor, and an email marketing platform. **Data ownership is the product.** Any
decision that moves lead, booking or subscriber data outside our own PostgreSQL is
wrong, however convenient.

## Non-negotiables

1. **No page builder.** Everything repeatable is a database-backed content type with
   its own editor, listing, detail template and SEO fields. See `docs/02-content-model.md`.
2. **No third-party form, booking or list vendor.** Resend is used as a sending
   transport only. Segments, campaigns and recipients live in our database.
3. **Publishing never requires a deploy.** If a non-developer cannot publish a service
   page from `/admin`, the task is not done.
4. **The performance budget is a release gate, not a goal.** See "Budget" below. CI
   fails the build when it is breached.
5. **Never run `next build` on the VPS.** Images are built in GitHub Actions and pulled.
   Building on a 4GB box is the known failure mode this architecture exists to avoid.
6. **Secrets never enter the repo.** `.env` is gitignored; `.env.example` documents keys.

## Stack (pinned)

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4 |
| API | Node 22 LTS, NestJS, Zod validation, OpenAPI |
| ORM / DB | Prisma, PostgreSQL 17 |
| Cache / queue | Redis 7, BullMQ |
| Auth | Owned by the API: identity, sessions, RBAC. Argon2id, first-party httpOnly session cookies (SameSite=Strict). No Auth.js, no external auth service |
| Email | Resend + React Email templates |
| Proxy | Traefik v3, automatic Let's Encrypt |
| CI/CD | GitHub Actions building to GHCR, VPS pulls and rolling restarts |

Do not swap any of these without asking. Several are load-bearing for the
infrastructure plan.

## Repo layout

```
/apps
  /web        Next.js: (marketing) and (admin) route groups
  /api        NestJS: modules per domain
  /worker     BullMQ processors
/packages
  /db         Prisma schema, migrations, seed
  /shared     Zod schemas and shared types (single source of truth)
  /emails     React Email templates
  /config     eslint, tsconfig, tailwind preset
/infra        Compose files, Traefik, backup and deploy scripts
/docs         Specifications. Read the relevant one before starting a task.
/reference    Approved HTML mockups. Match these visually.
```

Shared types live in `packages/shared` and are imported by both web and api. If a
type is duplicated across apps, that is a bug.

## Commands

```
pnpm dev            # all apps in watch mode
pnpm build          # type check, lint, build everything
pnpm db:migrate     # prisma migrate dev
pnpm db:seed        # placeholder content, safe on a reachable URL (never real proof)
pnpm db:seed:fixtures  # proof-shaped end-to-end fixtures; local and CI only
pnpm test           # unit tests
pnpm test:integration  # Postgres, Redis, Turnstile test keys; needs the Compose dev overrides
pnpm lh             # Lighthouse CI against the local build
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml --env-file .env up -d db redis
bash infra/scripts/deploy.sh staging <sha>   # on the server, run by CI (docs/01)
```

## Conventions

- Server Components by default. Add `"use client"` only when the component needs
  state, effects or browser APIs, and keep those components small and leaf-level.
- Validate at every boundary with Zod, schemas imported from `packages/shared`.
  The client never decides what is valid.
- No `any`. No non-null assertions to silence the compiler.
- Database access only through Prisma, only from the API and worker. `apps/web`
  never imports `@calwebtech/db`; server components and server actions call the API.
  Lint enforces this.
- Every mutation goes through the API, never straight to Prisma from a route handler
  in `web`, so business rules stay in one place.
- `/api/*` on the public origin belongs to the API (see Security). The web app never
  defines routes under `app/api`.
- Migrations are forward-only and committed. Never edit the production schema by hand.
- Every table carries `createdAt`, `updatedAt`, and `deletedAt` where soft deletion
  applies.

## Design system

Tokens are defined in `packages/config/tailwind/theme.css` (Tailwind v4 `@theme`) and
imported by `apps/web/app/globals.css`. Use the token names, never raw hex; lint rejects
arbitrary hex values in `apps/web`.

The brand is being rebuilt to the 2026 system in `F:/calwebtech-handoff/calwebtech-design-system`
(its `README.md` is the brand book; read it before touching a marketing component). Its
five rules, in short:

```
canvas #F4EFE6   canvas-raised #FAF7F0   canvas-sunken #ECE4D6
navy-900 #0A1628  ink #101A24   ink-muted #5C5648   ink-invert #F6F2EA
gold-500 #CFAE72 (dark grounds)   gold-ink #6F5320 (light)   gold-600 #A5813F (logo art)
hairline / hairline-strong / hairline-gold   scrim / scrim-strong
```

1. **No pure white.** `canvas` is the ground of every light section — not a page
   background, not a card, not a button fill.
2. **No boxes.** A list of things is editorial rows on hairlines, never bordered cards.
   `shadow-lift` is for the sticky nav and nothing else.
3. **Every section is cream, invert or plate**, alternating. Two cream sections in a row
   need `canvas-sunken` between them, not a border.
4. **Type is the ornament.** `display-mega` to `display-md`, Archivo at 700–800 with
   negative tracking. A section that looks empty needs a bigger heading, not a graphic.
5. **Air before decoration.** Section padding starts at 128px on desktop.

- Champagne has two forms and they are not interchangeable: `gold-500` only on dark
  grounds (it is 1.8:1 on cream), `gold-ink` on light ones. Never a gold gradient, never
  gold behind text, never more than three gold elements in one viewport.
- Display face: Archivo. Body face: Manrope. `meta` numerals: IBM Plex Mono. The admin
  keeps Plus Jakarta Sans and IBM Plex Sans, resolved inside `[data-theme='admin']`.
- Content width 1320px with the `shell` utility: 24px gutters, 64px from 900px.
- The logo is in `apps/web/public/brand` and rendered by `components/ui/logo.tsx`. Pick the
  file by the ground it sits on; never re-type the wordmark in a live font.
- **Still on the old palette:** the tokens below `--color-ink` in `theme.css` (`primary`,
  `mist`, `line`, `body` and the glows) belong to the white-and-cobalt site and are being
  removed family by family. `result` and `danger` stay for good: the dashboard resolves
  them inside `[data-theme='admin']`, and the `calwebtech/teal-usage` rule now guards
  them there. The brand's own rule for champagne — eyebrows, numerals, links and rules,
  never a heading or a price — is asserted in `components/services/sections.test.tsx`.
  `reference/homepage.html` and `reference/landing-page.html` record the design this
  replaces; they are history now, not the target (docs/08-decisions.md, 46).

- Motion: opacity and transform only. Nothing that shifts layout. All motion respects
  `prefers-reduced-motion`. In-page links are smoothed by `AnchorScroll`, never by CSS
  `scroll-behavior: smooth`, which lands anchors in the wrong place once sections use
  `content-auto` (docs/09-performance.md).

`reference/homepage.html` and `reference/landing-page.html` are client-approved. When
building a component, open the mockup first and match it. Improve the code, not the
design, unless asked.

## SEO rules, applied to every template

- One `<h1>` per page, matching the intent of the target keyword.
- **Answer block**: every service, industry, location, glossary and article template
  opens with a two to three sentence direct answer before any marketing narrative.
  This is the extraction target for AI answer engines and is not optional.
- H2 and H3 on content pages are written as questions buyers actually type.
- Per-record metadata: title under 60 chars, description under 155, canonical, OG image.
- Structured data per template, listed in `docs/03-page-specs.md`.
- Changing a published slug creates a permanent redirect automatically. Never silently.
- Filtered listing URLs are addressable and indexable where the combination is a
  deliberate target; otherwise they canonicalise to the unfiltered parent.
- Alt text is required at upload. The media library rejects images without it.

## Budget (CI gates)

| Metric | Gate |
|---|---|
| LCP, mobile | under 2.5s |
| INP | under 200ms |
| CLS | under 0.1 |
| Initial JS, marketing routes | under 150KB gzipped |
| Own client JS per route, framework excluded | under 20KB gzipped |
| Lighthouse | 90+ on all four categories |

The 150KB gate is measured by `pnpm lh`; the per-route own-code gate by
`pnpm --filter @calwebtech/web budget`, so framework growth and page growth stay separate.
Both are lab proxies. The real gate is field Core Web Vitals at p75, once Umami is
collecting them (docs/09-performance.md).

Heavy components (booking calendar, carousels, charts, the cost calculator) are
dynamically imported. Background video always has a poster image and never blocks LCP.

## Security

- The API owns identity, sessions and RBAC. Argon2id hashing. Session cookies are
  first-party, httpOnly, Secure and SameSite=Strict. CSRF protection on mutations.
- The API is served on the site's own origin at `/api` (Traefik routes the path and
  strips the prefix), never on an `api.` subdomain. No CORS is configured.
- RBAC enforced server-side on every admin route. Never trust the UI.
- Rate limiting per IP and per endpoint. Cloudflare Turnstile on public forms.
- Postgres and Redis on the internal Docker network only, never published to the host.
- Audit log on every admin login, content change, lead status change, export and
  campaign send.

## Accessibility

WCAG 2.2 AA is the working standard: token-level contrast, visible focus states, full
keyboard operability, semantic landmarks, correct heading order, labelled inputs with
described errors.

## Definition of done

A task is done when: it type checks, it lints, tests pass, the Lighthouse gate passes,
it works at 360px and 1440px, keyboard navigation works, the admin can edit whatever
the task produced without a deploy, and the acceptance criterion in
`docs/06-build-plan.md` is demonstrably met.

## Where to look

| Question | File |
|---|---|
| What are we building and why | `docs/00-project-brief.md` |
| How the system fits together | `docs/01-architecture.md` |
| What the content types are | `docs/02-content-model.md` |
| What sections a page has | `docs/03-page-specs.md` |
| What each page targets in search | `docs/04-seo-keyword-map.md` |
| Tokens and component inventory | `docs/05-design-system.md` |
| What to build next | `docs/06-build-plan.md` |
| Decisions taken since the handoff | `docs/08-decisions.md` |
| Budget math and rules for marketing routes | `docs/09-performance.md` |
| Building a site page family, and who owns which file | `docs/10-site-pages.md` |
| What may not change without asking | `RULES.md` |

## Ask before deciding

Raise these rather than guessing: changing a stack choice, adding a third-party
service, changing the data model in a way that loses history, anything that puts lead
data outside our database, and anything that would breach the performance budget.
