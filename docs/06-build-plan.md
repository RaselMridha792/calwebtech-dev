# 06. Build Plan

Tasks are ordered by dependency, not by menu order. Templates come before records,
because one template unblocks many pages.

Each task below is written to be handed to Claude Code as a single unit of work. Do
not start a task until the previous phase's gate passes.

---

## Phase 0 — Foundation

**0.1 Monorepo skeleton**
Set up pnpm workspaces with `apps/web`, `apps/api`, `apps/worker`, `packages/db`,
`packages/shared`, `packages/emails`, `packages/config`. Shared eslint, tsconfig and
Tailwind preset in `packages/config`. TypeScript strict everywhere.
*Gate:* `pnpm build` passes from a clean checkout.

**0.2 Local infrastructure**
`infra/docker-compose.yml` running db, redis, proxy, web, api, worker on a private
network with only the proxy publishing ports. `.env.example` complete.
*Gate:* `docker compose up` brings the stack up and health checks pass.

**0.3 Design tokens**
Port `tailwind.config.ts` and `globals.css` from this repo root into `apps/web`.
Verify the tokens render identically to `reference/homepage.html`.
*Gate:* a token test page matches the mockup colours and type scale exactly.

**0.4 Prisma schema and migrations**
Implement `prisma/schema.prisma`. Generate the first migration. Write a seed that
creates an owner user, 10 services, 3 service categories, 8 industries and 3 projects.
*Gate:* `pnpm db:migrate && pnpm db:seed` runs clean and the records are queryable.

---

## Phase 1 — Public site core

**1.1 Layout shell**
Utility bar with review popover, sticky header with mega menus, footer, breadcrumbs,
floating CTA, cookie consent gating analytics, conversion band component.
*Gate:* keyboard navigable, matches the mockup at 360px and 1440px.

**1.2 Homepage**
Every section from `reference/homepage.html`, wired to seeded data rather than
hardcoded markup. Background video with poster fallback per `docs/05-design-system.md`.
*Gate:* Lighthouse 90+ on all four categories, LCP under 2.5s on throttled mobile.

**1.3 Services index and detail template**
Dynamic from the Service type, including the answer block, FAQ accordion with FAQPage
schema, inline enquiry form pre-filled with service context.
*Gate:* creating a service record in the database publishes a live page with correct
metadata, schema and sitemap entry, with no deploy.

**1.4 Metadata and schema layer**
Per-record title, description, canonical, OG image generation. Structured data per
template as listed in `docs/04-seo-keyword-map.md`. Sitemap split by content type,
`robots.txt`, `llms.txt`.
*Gate:* Rich Results Test passes for Service, FAQPage and BreadcrumbList.

**1.5 Pricing, process, contact, legal set**
Static pages with the sections in `docs/03-page-specs.md`. Contact form with routed
enquiry types.
*Gate:* every form submits, stores a record with attribution, sends a confirmation and
an internal notification.

---

## Phase 2 — Proof

**2.1 Work index with faceted filters**
Filter by industry, service and platform, with the filter state written into the URL
so each combination is linkable and indexable. Canonical rules per
`docs/04-seo-keyword-map.md`.
*Gate:* a filtered URL loads server-side, is shareable, and canonicalises correctly.

**2.2 Case study template**
Answer block, metric band, at-a-glance strip, gallery, before and after, outcome,
client quote, optional video testimonial, related content.
*Gate:* Article and Review schema validate; metrics are mandatory fields.

**2.3 Industry template, about, team, testimonials**
Including the aggregated review widget as a dashboard-editable record with a scheduled
manual refresh, not a live third-party call in the render path.
*Gate:* the review widget renders from our database and survives the API being down.

---

## Phase 3 — Reach

**3.1 Location index and city template**
Including the sixty per cent uniqueness rule as an editor warning, LocalBusiness
schema with `areaServed`, and nearby-location linking capped at six.
*Gate:* publishing a city record produces a complete, unique, indexable page.

**3.2 Service-by-city matrix template**
Nine records at launch per `docs/04-seo-keyword-map.md`.
*Gate:* no matrix page duplicates its parent service or location page content.

**3.3 Before and after, awards, partners**
Drag slider with a range-input keyboard fallback.
*Gate:* the slider is fully operable by keyboard and touch.

---

## Phase 4 — Capture

**4.1 Cost calculator**
Eight steps, progress, email gate, result with breakdown, emailed copy, answers stored
as segmentation fields on the lead. Each step fires a measurable event.
*Gate:* completing the flow creates a lead with all eight answers queryable as fields,
and step-level drop-off is visible in reporting.

**4.2 Free audit, guides, insights, glossary, FAQ**
Article, glossary and guide templates with the answer-first structure. Ungated summary
on gated guides.
*Gate:* DefinedTerm and Article schema validate; a guide's summary is indexable.

**4.3 Site-wide search**
Postgres full-text across services, work, insights, glossary and FAQ. No external
search vendor.
*Gate:* results are typed, filterable and return in under 300ms locally.

---

## Phase 5 — Conversion and operations

**5.1 Booking engine**
Consultation types, weekly availability rules with date overrides and blackout dates,
minimum notice, server-side slot generation, timezone selector, database-level
double-booking constraint, `.ics` invite, confirmation and reminder emails at 24h and
1h, signed reschedule and cancel links, no-show tracking.
*Gate:* a booking can be made, confirmed, reminded, rescheduled and cancelled end to
end with correct timezone handling, and double-booking is impossible.

**5.2 Start a project and campaign landing template**
Multi-step with progressive saving. Landing template with no site navigation and
`noindex` by default.
*Gate:* abandonment is measurable per step.

**5.3 Admin dashboard**
Overview, leads inbox with attribution trail and pipeline status, bookings, subscribers,
segments and tags, campaigns, automations, content manager for every type, media
library with required alt text, page sections, forms and routing, team and roles,
settings, audit log, CSV and Excel export.
*Gate:* each role reaches exactly the modules assigned to it and nothing more.

**5.4 Campaign engine**
Segment builder re-evaluating at send time, branded templates, personalisation tokens
with fallbacks, test send, scheduling, worker batching against the provider rate limit,
per-recipient delivery rows, webhook events written back, suppression list that no
campaign can override.
*Gate:* a segment can be built and a campaign composed, previewed, test-sent, scheduled
and delivered with per-campaign reporting.

---

## Phase 6 — Launch

**6.1 Anti-spam and integrity**
Turnstile, honeypot, timing checks, per-IP and per-email rate limits, disposable-domain
and MX validation, duplicate detection that updates the existing lead rather than
creating a second record.

**6.2 Deliverability**
Dedicated sending subdomain, SPF, DKIM, DMARC starting in monitoring mode, warm-up
plan, one-click unsubscribe with List-Unsubscribe header, bounce and complaint webhooks
moving addresses to suppression.
*Gate:* SPF, DKIM and DMARC pass; unsubscribe and suppression work as specified.

**6.3 Hardening and observability**
SSH key-only with fail2ban, UFW default-deny, Cloudflare in front with the origin IP
masked, containers as non-root, CSP and HSTS, Sentry, Uptime Kuma, Umami.

**6.4 Backup and restore drill**
Nightly encrypted dumps off-site on a separate provider account, retention 7/4/6.
*Gate:* a backup is restored successfully into staging in the client's presence.

**6.5 Launch**
DNS cutover, redirect verification, Search Console and Bing Webmaster verification,
post-launch monitoring window, two recorded training sessions, handover package
transferred with all accounts in the client's name.

---

## Content dependencies

The most common cause of slippage is content, not code. These block the phases shown.

| Item | Volume | Blocks |
|---|---|---|
| Service copy with FAQs and price bands | 10 | Phase 1 |
| Pricing positions and calculator weighting | 1 set | Phase 1 and 4 |
| Case studies with verified metrics and imagery | 8 to 12 | Phase 2 |
| Testimonials with permission | 10 to 15 | Phase 2 |
| Team photos and bios | all client-facing | Phase 2 |
| Location evidence per city | 11 | Phase 3 |
| Awards, certifications, partner details | 6 to 12 | Phase 3 |
| Launch articles and glossary entries | 6 to 8, 30 to 40 | Phase 4 |
| Showreel and background video | 2 files | Phase 1 (poster fallback covers the gap) |
| Legal copy | 1 set | Phase 6 |

## Open decisions

These are unresolved. Ask rather than assuming.

1. Registered trading city, and whether a verifiable street address can be published.
2. Final list of ten services and their starting price bands.
3. Which case studies can name the client.
4. Whether real price bands are published on `/pricing/`.
5. Calculator output format: range, starting figure, or band label.
6. Review platforms to aggregate, and access to each.
7. Whether the campaign landing template is indexed or noindex by default.
