# 13. Collaborator handoff — campaign engine (Task 5.4)

You have write access to this repo as a collaborator. Your work happens on the branch
`tumit` — not on `main`, and not a new branch of your own. Push your commits there and
open your PRs from `tumit` against `main`.

> **`docs/14-remaining-work.md` is done and live (PR #32).** Your next tasks, in order, and
> what is not yours to touch, are in `docs/15-next-tasks.md`. This file still holds the
> reading order, the rules and the workflow.

## Read these first, in order

1. `RULES.md` — the normative source. Section 1 lists what needs the owner's permission
   before you touch it: design tokens, section layouts, copy, the logo, the stack, adding
   any third-party service, anything that breaches the performance budget. Read it before
   your first change, not after.
2. `CLAUDE.md` — restates the rules for an AI agent working in this repo, plus the stack,
   commands, conventions and where to look for each kind of question.
3. `docs/06-build-plan.md` — your task is **5.4 Campaign engine**, under Phase 5. Read the
   whole phase for context; 5.1–5.3 are done and you will build on top of them, not around
   them.
4. `docs/08-decisions.md` — decisions taken since the handoff, and an `## Open` section at
   the end of things still outstanding. Skim it so you do not re-discover something already
   settled or re-raise something already flagged.
5. `docs/02-content-model.md` and `docs/12-admin-dashboard.md` — the content types and the
   admin dashboard's module structure, since the campaign engine is an admin module.

## Where it stands

*2026-09-24.* Built on `tumit` in four parts, each recorded in `docs/08-decisions.md`:

| Part | What | Decision |
|---|---|---|
| 1 | Subscribers, tags, segments with a live count, the suppression list | 49 |
| 2 | Campaign composer, two branded templates, personalisation tokens, preview, test send | 50 |
| 3 | Scheduling, the rate-limited send, suppression checked at send time, unsubscribe links and page | 51 |
| 4 | Resend's delivery webhook, bounces and complaints to suppression, the per-campaign report | 52 |

`pnpm build`, the unit tests and `pnpm test:integration` pass, and every route is within the
own-code JS budget. Still to do before the PR is merged: a check of the new screens at 360px
and 1440px and by keyboard, the PR itself, and the owner's answers to the questions in
`docs/08-decisions.md`'s Open list. Where subscribers come from is answered (decision 53:
the homepage's "Subscribe now"); what is still open there is a confirmation email for it.

## What Task 5.4 is

> Segment builder re-evaluating at send time, branded templates, personalisation tokens
> with fallbacks, test send, scheduling, worker batching against the provider rate limit,
> per-recipient delivery rows, webhook events written back, suppression list that no
> campaign can override.
>
> *Gate:* a segment can be built and a campaign composed, previewed, test-sent, scheduled
> and delivered with per-campaign reporting.

The admin nav entry exists already at `/admin/campaigns` and currently renders a
`ModuleStub` (`apps/web/app/(admin)/admin/(shell)/campaigns/page.tsx`) that says exactly
this: deferred to 5.4. That is your starting point on the web side. Nothing exists yet on
the API or worker side under a `campaigns` module — you are building it from scratch,
following the patterns already in `apps/api/src/leads/`, `apps/api/src/booking/` and
`apps/api/src/admin/bookings/` for how a domain module, its admin controller and its
RBAC guard (`@RequireModule`) are put together.

Relevant existing pieces to build on rather than duplicate:

- `Subscriber` model and the subscriber list already exist (`apps/web/app/(admin)/admin/(shell)/subscribers/`)
  — segments are built from subscribers and their tags/attributes, not a new audience table.
- `packages/shared/src/email-jobs.ts` and the `EmailQueue`/BullMQ worker in `apps/worker/`
  are the pattern for queued, templated sends with an idempotency key — a campaign send is
  the same shape at larger scale (batching against Resend's rate limit, one job per
  recipient, not one job for the whole campaign).
- `packages/emails/` is where React Email templates live; a campaign's "branded templates"
  extend this, not a new templating system.
- The audit log (`apps/api/src/auth/audit.service.ts`) already covers "campaign send" as an
  audited action in `CLAUDE.md`'s Security section — wire into it, don't build a second log.

## Repo conventions (non-negotiable, from `RULES.md`)

- No third-party form, booking, list, or campaign vendor. Resend is a sending transport
  only — segments, templates, scheduling and delivery rows live in our PostgreSQL.
- Every mutation goes through the API; `apps/web` never imports `@calwebtech/db` or talks
  to Prisma directly. Lint enforces this.
- Zod schemas for the campaign contract go in `packages/shared`, imported by both web and
  api. A duplicated shape between the two is a bug.
- RBAC enforced server-side on every admin route — never trust the UI role check alone.
- No `any`, no non-null assertions, no raw hex colours in `apps/web` (lint rejects them —
  use the design tokens in `packages/config/tailwind/theme.css`).
- A task is done when: it type checks, lints, tests pass, the Lighthouse gate passes, it
  works at 360px and 1440px, keyboard navigation works, and the admin can do the whole
  workflow (build a segment, compose a campaign, test-send, schedule, see delivery
  reporting) without a deploy.

## Workflow

```
git clone <repo-url>
cd calwebtech-dev
git checkout tumit
pnpm install
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml --env-file .env up -d db redis
pnpm dev
```

Work in small commits directly on `tumit`, pushing as you go
(`git push origin tumit`). If the task is too large for one PR, say so and ask the
owner how to split it rather than opening a second branch on your own. Before opening a
PR:

```
pnpm build      # type check, lint, build everything
pnpm test       # unit tests
pnpm test:integration   # needs db + redis up, see above
```

Open the PR from `tumit` against `main`. CI (`verify`) runs type check, lint, full test
suite, Lighthouse budget gate and the own-code JS budget on every PR automatically — it
must be green before merge. **Do not merge your own PR or trigger a production deploy** —
hand it back to the owner for that; deploy is a manual `workflow_dispatch` step gated on
the production environment's secrets, which you do not have.

Whatever you decide that isn't obvious from the docs — a schema choice, a UI pattern, a
provider-rate-limit number — write it into `docs/08-decisions.md` the way the existing
entries do: what changed, what it replaces, why. That file is how nothing gets
re-litigated in a month.

## First prompt to paste into Claude Code

Open this repo in Claude Code, on the `tumit` branch, and paste this as your first
message:

> Read `RULES.md`, `CLAUDE.md`, `docs/06-build-plan.md` task 5.4, and
> `docs/13-collaborator-handoff.md`. Then look at how `apps/api/src/booking/` and
> `apps/api/src/admin/bookings/` are structured — module, service, controller, RBAC guard,
> shared Zod schemas — and at the `Subscriber` model and `EmailQueue`/BullMQ worker
> pattern. Summarise back to me: what a "campaign" needs as a Prisma model, what the
> segment builder's query shape should look like given the existing `Subscriber` fields,
> and a phased plan for building 5.4 that keeps every phase mergeable on its own (segments
> first, then composer and templates, then scheduling and send, then delivery
> reporting/webhooks). Do not write code yet — I want to agree the plan first.

That gets you a plan reviewed before any code exists, which is the same discipline this
repo has used for every task so far — see `docs/07-claude-code-prompts.md` for the pattern
in general, beyond this one task.
