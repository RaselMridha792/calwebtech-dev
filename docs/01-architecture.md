# 01. Architecture

## Containers

| Container | Role | Exposed |
|---|---|---|
| proxy | Traefik v3, TLS, Let's Encrypt, routing, security headers | 80, 443 |
| web | Next.js standalone, public site and `/admin` | internal |
| api | NestJS REST: content, leads, bookings, campaigns, auth, webhooks | via proxy at `/api` on the site origin |
| worker | BullMQ consumer: email, reminders, revalidation, image processing | internal |
| db | PostgreSQL 17, named volume | internal |
| redis | Queue, rate limiting, cache | internal |
| backup | pg_dump plus restic, nightly, encrypted, off-site | internal |
| analytics | Umami, first-party | internal, proxied |
| uptime | Uptime Kuma | internal, proxied |

Only `proxy` publishes host ports. The internal network is declared `internal: true`.

The API shares the site's origin: Traefik routes `https://<domain>/api/*` to `api` and
strips the prefix. There is no `api.` subdomain, so session cookies stay first-party
with `SameSite=Strict` and no CORS is needed. Server-side calls from `web` go straight
to `http://api:4000` on the internal network.

## Rendering strategy, per route group

| Routes | Strategy | Revalidation |
|---|---|---|
| Marketing statics (home, about, process, pricing, legal) | SSG + ISR | on publish webhook, plus time fallback |
| Services, industries, work, locations, insights, glossary | SSG per record + ISR | on-demand from the dashboard on save |
| Listing pages with filters | static shell, client filtering over prefetched data; server pagination past a threshold | same as parent type |
| Booking availability | server-rendered per request | never cached |
| Forms and submissions | server actions and API routes | never cached |
| `/admin` | client-rendered authenticated app | live |

## Request flow

1. Cloudflare serves cached assets at the edge, forwards dynamic requests.
2. Traefik terminates TLS, routes to `web` on the internal network.
3. `web` serves a pre-rendered page, or calls `api` internally for live data.
4. Submissions post to `api`, which validates with Zod, runs bot and rate-limit checks,
   writes to Postgres, enqueues notification jobs in Redis.
5. `worker` consumes jobs and sends via Resend. Delivery webhooks write back against
   the lead or campaign record.
6. Postgres and Redis are never reachable from the public internet.

## Deployment

Push to the release branch triggers: type check, lint, test, build, then multi-stage
Docker images tagged by commit SHA pushed to GHCR, then Prisma migrations as a one-off
container, then a VPS pull and rolling restart gated on health checks, then smoke
tests, with automatic rollback to the previous tag on failure.

Images are tagged by SHA, never `latest`, so rollback is a tag change.

## Environments

- **Production**: primary domain, protected branch deploys, full backup and monitoring.
- **Staging**: same Compose file, separate project name, volumes and database, behind
  HTTP basic auth with noindex headers.
- **Local**: same Compose file with development overrides.

Configuration is entirely environment-variable driven. No environment-specific code
branches.

## Backup and recovery

Nightly logical dumps plus weekly snapshots, encrypted before leaving the server,
retained 7 daily / 4 weekly / 6 monthly, pushed to a provider account separate from
the VPS. RPO 24 hours, RTO 4 hours. The restore procedure is tested once during
handover, not assumed.
