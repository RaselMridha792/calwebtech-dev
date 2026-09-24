# 01. Architecture

## Containers

| Container | Role | Exposed |
|---|---|---|
| proxy | Traefik v3, TLS, Let's Encrypt, routing, security headers. One per server, shared by every environment (`infra/proxy`) | 80, 443 |
| web | Next.js standalone, public site and `/admin` | internal |
| api | NestJS REST: content, leads, bookings, campaigns, auth, webhooks | via proxy at `/api` on the site origin |
| worker | BullMQ consumer: email, campaign sends and the campaign sweep (decision 51), reminders, revalidation, image processing | internal |
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

A push to `main` runs verify, then builds the web, api and worker images, tags them by
commit SHA and pushes them to GHCR. When the repository variable `DEPLOY_ENABLED` is
`true`, the deploy job copies `infra/` for that commit to the server over SSH, with the
host key pinned, and runs `infra/scripts/deploy.sh staging <sha>`:

1. The shared edge proxy (`infra/proxy`, Compose project `calwebtech-proxy`) comes up.
2. The images for the new tag are pulled. The tag is passed in the environment; the
   stack's env file still names the release that is live.
3. Postgres and Redis come up, and `node dist/migrate.js` applies migrations from the new
   API image.
4. A stack with `SEED_ON_DEPLOY=true` (staging only) re-runs the placeholder seed,
   `node dist/seed.js`.
5. Web, api and worker roll out, gated on their health checks.
6. `infra/scripts/smoke.sh` checks the routes, and on staging basic auth and noindex.

The new tag is written to the env file only after the smoke test passes, so a failed or
interrupted deploy leaves it on the last release that went live. A failing step brings
that release back, and a failed first deploy stops the new release. Images are tagged by
SHA, never `latest`, so rollback is a tag change. Production deploys only by hand:
"Run workflow" on the release workflow with a stack and a commit SHA on `main`, whose
images already exist; the same button with the previous SHA is the rollback. The server
itself is prepared once by `infra/scripts/bootstrap-server.sh`; the procedure is
`docs/11-vps-deploy.md`.

## Environments

One server runs one shared Traefik (`infra/proxy`), which owns ports 80 and 443. Each
environment is its own Compose project running `infra/docker-compose.yml`, with its own
env file, database, volumes, host name and router names.

| | Production | Staging | Local |
|---|---|---|---|
| Compose project | `calwebtech-production` | `calwebtech-staging` | `calwebtech`, db and redis only |
| Env file | `/srv/calwebtech/env/production.env` | `/srv/calwebtech/env/staging.env`, from `infra/env/staging.env.example` | repo-root `.env` |
| `APP_ENV` | `production` | `staging` | `development` |
| Edge middlewares | compression | basic auth, `X-Robots-Tag: noindex`, compression | none |
| Seed on deploy | never | placeholder seed on every deploy | `pnpm db:seed`, plus `pnpm db:seed:fixtures` for end-to-end tests |
| Turnstile | client keys, required | Cloudflare test keys, or none | Cloudflare test keys |
| Email | Resend | log transport | log transport |

Every stack's API sits on the shared edge network, so the name `api` would resolve across
stacks. Web reaches its own API by the stack alias `<STACK>-api` (`API_INTERNAL_URL`).
Local development runs Postgres and Redis from the same Compose file with
`docker-compose.dev.yml`.

Configuration is entirely environment-variable driven. No environment-specific code
branches.

## Backup and recovery

Nightly logical dumps plus weekly snapshots, encrypted before leaving the server,
retained 7 daily / 4 weekly / 6 monthly, pushed to a provider account separate from
the VPS. RPO 24 hours, RTO 4 hours. The restore procedure is tested once during
handover, not assumed.

The `backup` container (`infra/backup/Dockerfile`, the `ops` profile) does this:
`infra/scripts/backup-entrypoint.sh` streams `pg_dump` straight into a restic
repository off the server every night, snapshots the media volume, applies the retention
above and checks the repository weekly; it turns unhealthy once a backup is 26 hours
overdue. `infra/scripts/restore.sh` is the drill, into staging first. Both need a restic
destination in the stack's env file before they run.
