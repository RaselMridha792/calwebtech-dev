# Calwebtech Platform

Custom Next.js marketing and acquisition platform, self-hosted on Docker.

## Start here

1. Read `CLAUDE.md`. It is the working contract for this repo.
2. `cp .env.example .env` and fill in the values.
3. `docker compose -f infra/docker-compose.yml up -d db redis`
4. `pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev`

## Documentation

- `docs/00-project-brief.md` — scope, audience, success metrics
- `docs/01-architecture.md` — services, rendering strategy, request flow
- `docs/02-content-model.md` — every content type and its fields
- `docs/03-page-specs.md` — page-by-page sections and schema
- `docs/04-seo-keyword-map.md` — keyword clusters mapped to URLs
- `docs/05-design-system.md` — tokens, patterns, component inventory
- `docs/06-build-plan.md` — phased tasks with acceptance criteria

## Reference

`reference/homepage.html` and `reference/landing-page.html` are the client-approved
designs. Open them in a browser before building any component.
