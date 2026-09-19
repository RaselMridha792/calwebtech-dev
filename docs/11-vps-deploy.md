# 11. Deploying to the VPS

How the whole platform runs on one server, in Docker, deployed from GitHub. Read
`docs/01-architecture.md` (Deployment, Environments) first; this file is the procedure.
Everything the server needs is under `infra/`, and nothing is built on the server:
images come from GitHub Actions, tagged by commit SHA, and the server pulls them.

## What runs on the server

| Container | Image | Role | Memory limit |
|---|---|---|---|
| `traefik` | `traefik:v3` | The edge: ports 80 and 443, TLS from Let's Encrypt, routing by host name, headers, compression. One per server, shared by every stack (`infra/proxy`) | none set |
| `web` | `…-web:<sha>` | Next.js, the public site | 1 GB |
| `api` | `…-api:<sha>` | NestJS, at `https://<host>/api/*` on the same origin | 768 MB |
| `worker` | `…-worker:<sha>` | BullMQ: lead emails through Resend | 512 MB |
| `db` | `postgres:17-alpine` | The database. Internal network only, never a host port | none set |
| `redis` | `redis:7-alpine` | Queue and rate limits. Internal only | none set |
| `backup` | `…-backup:<sha>` | Nightly encrypted dump off-site. `ops` profile, started by hand | 256 MB |
| `analytics`, `uptime` | Umami, Uptime Kuma | `ops` profile, not deployable yet (Task 6.3) | |

A stack is one Compose project (`calwebtech-staging` or `calwebtech-production`) running
`infra/docker-compose.yml` with its own env file, database and volumes. The limits above
add up to about 2.5 GB before Postgres and Redis, so **a 4 GB server runs one stack**.
Staging and production side by side need 8 GB or two servers.

## Before the first deploy

1. **A server**: Ubuntu 24.04 LTS, 2 vCPU, 4 GB, 40 GB disk, root reachable by SSH key.
   Nothing else installed; `bootstrap-server.sh` does the rest.
2. **A host name that resolves to it.** Let's Encrypt issues certificates only to names,
   never to bare addresses, and validates over port 80. Use the real domain if it exists.
   Without one, use a free name from a provider that is on the Public Suffix List, such as
   `something.duckdns.org`: Let's Encrypt then applies its 50-certificates-a-week limit to
   your name alone. Do not use `sslip.io` or `nip.io` names; they are not on that list, so
   the limit is shared with everyone who uses them and is often exhausted, and the first
   deploy fails at the certificate. Switching to the real domain later is a change of
   `SITE_HOST` and `APP_ORIGIN` in the env file and a redeploy.
3. **An SSH key for the CI**, made on your machine, never on the server:
   ```
   ssh-keygen -t ed25519 -N '' -C calwebtech-deploy -f calwebtech-deploy
   ```
   `calwebtech-deploy` (private) becomes the `VPS_SSH_KEY` secret; `calwebtech-deploy.pub`
   is the `DEPLOY_PUBKEY` the bootstrap script installs.
4. **GHCR access for the server.** Images are private by default. Either make the four
   packages public (repository → Packages → each package → Package settings → Change
   visibility), or create a classic personal access token with `read:packages` only and
   store it as `GHCR_PULL_TOKEN` with your GitHub user as `GHCR_PULL_USER`.
5. **Turnstile keys, for production.** Production fails closed without them (decisions 18
   and 26): the web server exits at startup and the API refuses to start. Create a widget
   for the host name in the Cloudflare dashboard (Turnstile is free and needs no DNS
   change) and keep the site key and secret for the env file. Staging runs on
   Cloudflare's always-pass test keys.
6. **Content, for production.** See "Production needs content first" below before
   planning a production deploy.

## Step 1. Bootstrap the server, once

From the repository root on your machine:

```
rsync -az infra/ root@<server-ip>:/srv/calwebtech/infra/
ssh root@<server-ip>
```

On the server, one command. Staging:

```
STACK=staging SITE_HOST=staging.example.com ACME_EMAIL=you@example.com \
DEPLOY_PUBKEY="$(cat <<'EOF'
ssh-ed25519 AAAA... calwebtech-deploy
EOF
)" STAGING_BASIC_AUTH=preview:choose-a-password \
bash /srv/calwebtech/infra/scripts/bootstrap-server.sh
```

Production is the same without `STAGING_BASIC_AUTH` and with `STACK=production` and its
host name. Add `ADMIN_PUBKEY="ssh-ed25519 ..."` with your own public key if root has no
key yet; the script refuses to disable password logins if that would lock everyone out.

What it does, in order (`infra/scripts/bootstrap-server.sh`): Docker Engine from Docker's
repository with log rotation; the `deploy` user, key-only, in the docker group;
`/srv/calwebtech/{env,secrets,infra}`; the env file from `infra/env/<stack>.env.example`
with the database password and secrets generated; on staging the basic-auth users file; a
2 GB swapfile; UFW allowing SSH, 80 and 443 only; fail2ban; password logins off;
unattended security updates; time sync. It is safe to run again: it never overwrites the
env file or the users file.

It ends by printing the four GitHub secrets (`VPS_HOST`, `VPS_PORT`, `VPS_USER`,
`VPS_KNOWN_HOSTS`) and the env keys still empty. Fill those now:

```
nano /srv/calwebtech/env/<stack>.env     # as root or deploy; mode 600
```

Staging needs nothing else to start. Production needs `TURNSTILE_SITE_KEY` and
`TURNSTILE_SECRET`. Leave `TAG` empty: `deploy.sh` writes it. Leave the backup keys empty
until "Backups" below.

## Step 2. DNS

An `A` record for `SITE_HOST` pointing at the server's public address. Wait until
`dig +short <host>` (or `nslookup`) answers with the address from anywhere; Let's Encrypt
must reach port 80 by that name during the first deploy, or Traefik serves its own
self-signed certificate and the smoke test fails.

If the DNS is at Cloudflare, keep the record **DNS only** (grey cloud) for the first
deploy so the ACME challenge reaches the server directly. Proxying through Cloudflare
(Task 6.3) comes after the certificate exists and needs `TRUST_PROXY_HOPS` raised.

## Step 3. GitHub

Repository → Settings → Environments. Create `staging` and `production`. In each, add the
secrets the bootstrap script printed, plus the deploy key:

| Secret | Value |
|---|---|
| `VPS_HOST` | the server's address (or the name, if `VPS_KNOWN_HOSTS` uses the name) |
| `VPS_PORT` | `22` unless SSH was moved |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | the private key file, whole, including the BEGIN and END lines |
| `VPS_KNOWN_HOSTS` | the line the script printed |
| `GHCR_PULL_USER`, `GHCR_PULL_TOKEN` | only while the packages are private |

Repository → Settings → Variables: `STAGING_URL` and `PRODUCTION_URL` (the deployment
links on the Actions page), and `DEPLOY_ENABLED=true` to switch on the automatic staging
deploy. On the `production` environment, add yourself as a required reviewer: every
production deploy then waits for a click.

## Step 4. Deploy

**Staging** deploys on every push to `main` once `DEPLOY_ENABLED` is `true`. To deploy a
specific commit, or before switching that on: Actions → release → Run workflow → stack
`staging`, tag = the full 40-character SHA of a commit on `main` whose run passed.

**Production** never deploys on push. Actions → release → Run workflow → stack
`production`, tag = the SHA. The job refuses a short SHA or one that is not on `main`,
copies `infra/` at that commit to the server and runs `deploy.sh`.

`infra/scripts/deploy.sh` then, on the server: brings the proxy up, pulls the three
images, starts Postgres and Redis, runs the migrations (`node dist/migrate.js`), seeds
placeholder content where `SEED_ON_DEPLOY` is true or imports the demo content once
where `IMPORT_CONTENT_ON_DEPLOY` is true ("Production needs content first" below), rolls
out web, api and worker gated on their health checks, and runs `infra/scripts/smoke.sh`
against `https://<SITE_HOST>`. Only when the
smoke test passes is the new tag written to the env file. A failing step rolls back to
the previous tag; on a first deploy, with nothing to roll back to, it stops the failed
release and leaves the database running.

To watch from the server while it runs:

```
ssh deploy@<server-ip>
docker ps
docker compose -p calwebtech-staging --env-file /srv/calwebtech/env/staging.env \
  -f /srv/calwebtech/infra/docker-compose.yml logs -f --tail 100 web api worker
docker compose -p calwebtech-proxy --env-file /srv/calwebtech/env/staging.env \
  -f /srv/calwebtech/infra/proxy/docker-compose.yml logs --tail 50   # certificate errors show here
```

## Step 5. Check

The smoke test already confirmed `/health/`, `/api/health`, `/` and the campaign page,
basic auth (staging), `X-Robots-Tag: noindex` (staging) and `Strict-Transport-Security`.
Then by hand:

```
curl -sI https://<host>/ -u preview:password | grep -iE 'strict-transport|x-robots|content-security'
curl -s  https://<host>/api/health -u preview:password
docker ps --format '{{.Names}} {{.Status}}'     # every container (healthy)
```

Pages stay `noindex` until the settings say otherwise, whatever the stack. When the
content is real:

```
docker compose -p calwebtech-production --env-file /srv/calwebtech/env/production.env \
  -f /srv/calwebtech/infra/docker-compose.yml exec api node dist/settings-cli.js set site.indexing '{"index":true}'
# and homepage.indexing the same way (decisions 27 and 37)
```

## Rollback

The same button. Actions → release → Run workflow with the SHA that was live before; the
earlier deploy log's `deploy: <stack> at <new> (previous: <old>)` line names it, and so
does `TAG=` in the env file before the deploy. Images stay in GHCR, so nothing is rebuilt.
Migrations are forward-only: a rollback across a migration that dropped or renamed a column
needs a restore instead.

## Production needs content first

Production never seeds: the launch seed replaces rows wholesale and refuses
`APP_ENV=production` (`packages/db/src/seed/guard.ts`). On an empty database the
`home.content` and `site.*` settings do not exist, so `GET /pages/home` and
`GET /site/chrome` answer 500, every page errors (the site layout needs the chrome), the
smoke test fails on `/`, and `deploy.sh` stops the release. The demo content the Vercel
site shows lives in `apps/web/static-content` and is used only while `API_INTERNAL_URL`
is unset; with the API live, pages render from the database.

The content import closes that gap (decision 43). With `IMPORT_CONTENT_ON_DEPLOY=true`
in the env file, the first deploy runs `node dist/import-content.js` after the
migrations: it loads every snapshot into the database, so the site comes up with the
same content the Vercel demo shows, forms included, and the smoke test passes. It writes
a marker setting (`content.import`), and every later deploy skips it, so whatever the
owner edits in the admin afterwards stays. `deploy.sh` refuses a stack that has both
`SEED_ON_DEPLOY` and `IMPORT_CONTENT_ON_DEPLOY` set, because the seed would put
placeholders back over the imported content.

To import again on purpose (for example after resetting the database):

```
docker compose -p calwebtech-production --env-file /srv/calwebtech/env/production.env \
  -f /srv/calwebtech/infra/docker-compose.yml run --rm api node dist/import-content.js --force
```

`--force` overwrites the rows the importer owns with the snapshot values again; edits
made in the admin to those rows are lost. Records added in the admin that the snapshots
do not know about are left alone.

What the import proves before it ships: `apps/api/src/import/import.integration.test.ts`
runs in CI on a database of its own and requires every API view to equal its snapshot.
A family whose check fails there does not import correctly, whatever the page looks like.

Staging can carry either the placeholder seed (`SEED_ON_DEPLOY=true`, the default) or
the same imported content (`IMPORT_CONTENT_ON_DEPLOY=true`); a preview of the real
content behind basic auth is the second.

## Operating the server

- **Settings without a deploy**: `exec api node dist/settings-cli.js get|set <key>` as
  above. Keys: `site.contact`, `site.proof`, `leads.notificationRecipients`,
  `homepage.indexing`, `site.indexing`.
- **Logs**: `docker compose … logs -f <service>`. Rotated by the daemon at 10 MB × 3 per
  container, which the bootstrap script set.
- **Disk**: old images stay after a deploy. `docker image prune -af --filter
  until=168h` weekly, by hand or a cron entry for the deploy user.
- **Updates**: security patches install themselves; a kernel update waits for a reboot,
  `needs-restarting` or `/var/run/reboot-required` says when. Containers restart on their
  own (`restart: unless-stopped`).
- **Changing the host name** (DuckDNS to the real domain): edit `SITE_HOST` and
  `APP_ORIGIN`, point the new DNS record, redeploy the current tag. Traefik requests the
  new certificate on the first request to the new name.

## Backups

Off by default; nothing runs until the env file has a destination. Choose a provider
account separate from the VPS (Backblaze B2 is the cheap, S3-compatible option; a Hetzner
Storage Box works over `sftp:`), then fill `RESTIC_REPOSITORY`, `RESTIC_PASSWORD` (keep a
copy somewhere safe: without it every backup is unreadable) and the provider keys in the
env file, and:

```
C="docker compose -p calwebtech-<stack> --env-file /srv/calwebtech/env/<stack>.env -f /srv/calwebtech/infra/docker-compose.yml --profile ops"
$C run --rm backup once                 # first backup now; exit 0 means it is off-site
$C up -d backup                         # then the nightly schedule (BACKUP_TIME, 03:00)
$C run --rm backup restic snapshots     # what is off-site
```

`docker ps` shows the container unhealthy once a backup is 26 hours overdue. The restore
drill (Task 6.4) goes into staging, never straight into production:

```
$C stop web api worker
$C run --rm -e RESTORE_CONFIRM=yes backup /scripts/restore.sh latest
$C run --rm api node dist/migrate.js
$C up -d --wait web api worker
```

The header of `infra/scripts/restore.sh` has the details, including restoring
production's repository into staging. A deploy does not move the backup container to the
new tag; `$C up -d backup` after a release does.

## Known limits

- One stack per 4 GB server. The bootstrap script adds swap so a spike degrades instead of
  killing a container, but two stacks do not fit.
- `web`, `api` and `worker` read one env file, so every container sees every key,
  including the backup credentials. A separate ops env file would be tighter.
- The `media` volume is mounted only by `backup` so far; the API does not write uploads
  there yet (the media library is Task 5.3), so that snapshot is empty for now.
- `Strict-Transport-Security` carries `includeSubDomains`. Decide apex or `www` before
  launch (Task 6.5) and serve the other as a redirect; the router today matches one host.
- The content security policy is report-only until the web app gets nonce plumbing
  (`infra/traefik/dynamic/security.yml` explains what enforcing it would take).
