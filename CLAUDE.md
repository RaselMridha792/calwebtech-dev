# Calwebtech Platform

You are building the Calwebtech agency website: a custom, self-hosted marketing and
acquisition platform. This file is the contract. Read it fully before the first task.

## What this is

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
| Frontend | Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS |
| API | Node 22 LTS, NestJS, Zod validation, OpenAPI |
| ORM / DB | Prisma, PostgreSQL 17 |
| Cache / queue | Redis 7, BullMQ |
| Auth | Auth.js, Argon2id, httpOnly session cookies, RBAC |
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
pnpm db:seed        # seed content types with launch records
pnpm test           # unit tests
pnpm lh             # Lighthouse CI against the local build
docker compose -f infra/docker-compose.yml up -d
```

## Conventions

- Server Components by default. Add `"use client"` only when the component needs
  state, effects or browser APIs, and keep those components small and leaf-level.
- Validate at every boundary with Zod, schemas imported from `packages/shared`.
  The client never decides what is valid.
- No `any`. No non-null assertions to silence the compiler.
- Database access only through Prisma, only from the API or server components.
  Never from a client component.
- Every mutation goes through the API, never straight to Prisma from a route handler
  in `web`, so business rules stay in one place.
- Migrations are forward-only and committed. Never edit the production schema by hand.
- Every table carries `createdAt`, `updatedAt`, and `deletedAt` where soft deletion
  applies.

## Design system

Tokens are already defined in `tailwind.config.ts` and `apps/web/app/globals.css`.
Use the token names, never raw hex.

```
ink #0A1D37   primary #1550E0   result #0E9F87
mist #EEF3F9  mist2 #F7FAFD     line #DCE4EE   body #41536B
```

- `result` (teal) is reserved for outcome metrics. Do not use it for decoration.
- Display face: Plus Jakarta Sans. Body face: IBM Plex Sans.
- Content width 1440px with 24px gutters, 56px from the large breakpoint.
- Section rhythm alternates: white, tinted gradient, image with overlay, colour band.
  See `reference/homepage.html` for the approved sequence.
- Motion: opacity and transform only. Nothing that shifts layout. All motion respects
  `prefers-reduced-motion`.

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
| Lighthouse | 90+ on all four categories |

Heavy components (booking calendar, carousels, charts, the cost calculator) are
dynamically imported. Background video always has a poster image and never blocks LCP.

## Security

- Argon2id hashing, httpOnly and SameSite cookies, CSRF protection.
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

## Ask before deciding

Raise these rather than guessing: changing a stack choice, adding a third-party
service, changing the data model in a way that loses history, anything that puts lead
data outside our database, and anything that would breach the performance budget.
