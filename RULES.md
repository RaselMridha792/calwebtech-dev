# Rules

Read this before your first change. It is the short list of things this codebase does not
let you decide on your own.

Everything here is a rule, not a preference. Where a rule has a reason, the reason is given
— a rule you understand is one you can apply to a case nobody wrote down. Where a rule
points at a longer document, that document has the detail; this file has the boundary.

**This file is the normative source.** `CLAUDE.md` restates it for AI agents working in the
repository, and the `docs/` set carries the specifications. If any of them disagree with
this file, this file wins and the other one is a bug.

---

## 1. What needs the owner's permission

Stop and ask before doing any of these. Not "do it and flag it" — ask first.

| Change | Why it is not yours to make |
| --- | --- |
| Any design token: a colour, the type scale, spacing, a radius, a shadow | The brand is a system; one new colour makes it a palette instead |
| The form of a section — a grid becoming a list, a stack becoming cards | The forms are the brand. Changing one changes how the site reads |
| Removing, reordering or rewriting copy | The words are the owner's. Design work changes the dressing, never the content |
| The logo, its files, its colours or its clear space | It ships as outlined artwork with rules of its own (`docs/05`) |
| A stack choice — framework, database, hosting, auth, email transport | Several are load-bearing for the infrastructure plan (`CLAUDE.md`, "Stack") |
| Adding a third-party service of any kind | See rule 2 |
| Anything that breaches a performance budget | The budgets are release gates, not goals (rule 5) |
| A data model change that loses history | Deleted history does not come back |

If the answer is yes, write it down in `docs/08-decisions.md` — what changed, what it
replaces, and why. A decision that is not recorded gets re-litigated in three months.

**The design does not drift.** If you find yourself adjusting a colour "just a little" to
make something look right, the thing to change is the layout or the size, not the token.

---

## 2. Data ownership is the product

This platform exists to replace three things the business used to rent: a page builder, a
form vendor and an email marketing platform. Every rule below follows from that.

- **No page builder.** Anything repeatable is a database-backed content type with its own
  editor, listing, detail template and SEO fields.
- **No third-party form, booking or list vendor.** Resend is a sending transport only.
  Segments, campaigns, recipients, bookings and leads live in our PostgreSQL.
- **Publishing never requires a deploy.** If a non-developer cannot publish a page from
  `/admin`, the work is not finished.
- **Nothing that puts lead, booking or subscriber data outside our own database**, however
  convenient the integration looks.

---

## 3. Design

The brand book is `F:/calwebtech-handoff/calwebtech-design-system/README.md`. Read it
before you touch a marketing component. `docs/05-design-system.md` records how it is
implemented here. The five rules it rests on:

1. **No pure white.** `canvas` (`#F4EFE6`) is the ground of every light section. White is
   not a page background, not a card, not a button fill.
2. **No boxes.** A list of peers is editorial rows on hairlines, not a grid of bordered
   cards. The only shadow in the system is on the sticky nav (`shadow-lift`).
3. **Every section is cream, invert or plate**, alternating. Two light sections in a row
   need `canvas-sunken` between them, not a border.
4. **Type is the ornament.** If a section looks empty the heading is too small. The answer
   is a bigger heading, never a graphic.
5. **Air before decoration.** Section padding starts at 128px on desktop.

Beyond those:

- **Tokens only.** Never a raw hex value in `apps/web`; lint rejects it. A colour that is
  not a token does not exist.
- **Champagne has two forms and they are not interchangeable.** `gold-500` on dark grounds
  only — it is 1.8:1 on cream and disappears. `gold-ink` on light ones. `gold-600` is the
  logo's fill on light grounds, for artwork rather than text. Gold may carry an eyebrow, a
  numeral, a link or a rule; never a heading, never a price, never a fill behind text, and
  never more than three elements in one viewport.
- **Display sizes have a ceiling.** `display-mega` is for a cream hero only. Over a
  photograph, `display-xl` is the ceiling — the brand's own words: "where the letterforms
  are not fighting an image". One display size per section.
- **A scrim covers the whole plate**, not its lower edge. A gradient that fades at one edge
  leaves the first line of a headline on raw photography, which is exactly where contrast
  fails.
- **The logo is never re-typed in a live font.** Use the file that matches the ground it
  sits on (`apps/web/public/brand`, rendered by `components/ui/logo.tsx`).
- **Motion is opacity and transform only.** Nothing that shifts layout, nothing that
  bounces, nothing that loops except the logo rail. Every animation is disabled under
  `prefers-reduced-motion`.
- **Content width is 1320px**, through the `shell` utility.

---

## 4. Code

- **Server Components by default.** `"use client"` only for state, effects or browser APIs,
  and those components stay small and leaf-level.
- **Validate at every boundary with Zod**, schemas imported from `packages/shared`. The
  client never decides what is valid.
- **No `any`. No non-null assertions** to silence the compiler.
- **Database access only through Prisma, only from the API and the worker.** `apps/web`
  never imports `@calwebtech/db`; server components and server actions call the API. Lint
  enforces this.
- **Every mutation goes through the API**, so business rules live in one place.
- **`/api/*` on the public origin belongs to the API.** The web app defines no routes under
  `app/api`.
- **Migrations are forward-only and committed.** Never edit a production schema by hand.
- **A type duplicated across apps is a bug.** Shared types live in `packages/shared`.
- **Secrets never enter the repo.** `.env` is gitignored; `.env.example` documents the keys.
- **Never run `next build` on the VPS.** Images are built in CI and pulled. Building on the
  server is the failure this architecture exists to avoid.

---

## 5. The budgets are release gates

| Metric | Gate |
| --- | --- |
| LCP, mobile | under 2.5s |
| INP | under 200ms |
| CLS | under 0.1 |
| Initial JS, marketing routes | under 150 kB gzipped |
| Own client JS per route, framework excluded | under 20 kB gzipped |
| Lighthouse | 90+ on all four categories |

CI fails the build when one is breached. You do not get to ship past them and fix it later.

Two things worth knowing before you reach for a convenience:

- **`next/image` costs about 12 kB of client runtime.** For a vector the optimiser cannot
  improve — a logo, an icon — that is most of a page's budget spent on nothing. A plain
  `img` with its intrinsic width and height costs nothing and shifts nothing.
- **Heavy components are dynamically imported** (booking calendar, carousels, charts, the
  cost calculator). Background video always has a poster and never blocks LCP.

Measure with `pnpm lh` and `pnpm --filter @calwebtech/web budget`. Both are lab proxies;
the real gate is field Core Web Vitals at p75 (`docs/09-performance.md`).

---

## 6. SEO, on every template

- One `<h1>` per page, matching the target keyword's intent.
- **The answer block is not optional.** Every service, industry, location, glossary and
  article template opens with a two to three sentence direct answer before any marketing
  narrative. It is the extraction target for AI answer engines.
- H2 and H3 on content pages are written as questions buyers actually type.
- Per-record metadata: title under 60 characters, description under 155, canonical, OG
  image.
- **Changing a published slug creates a permanent redirect automatically.** Never silently.
- Alt text is required at upload. The media library refuses an image without it.

---

## 7. Accessibility

WCAG 2.2 AA is the working standard, not an aspiration: token-level contrast, visible focus
states, full keyboard operability, semantic landmarks, correct heading order, labelled
inputs with described errors.

Specifically, and learned the hard way:

- **A menu that opens a panel keeps its keyboard contract.** Escape dismisses without moving
  focus out, the control reopens it, and `aria-expanded` follows what is on screen. If you
  make a menu label a link, the panel needs its own control beside it — a link has no
  `aria-expanded`, and Enter on one navigates.
- **Touch targets are at least 44px**, and focus is a 2px ring at 2px offset on every
  interactive element.

---

## 8. Definition of done

A change is done when all of these are true:

- it type checks and lints
- unit, contract and end-to-end tests pass
- the Lighthouse gate passes
- it works at 360px and at 1440px
- keyboard navigation works
- an admin can edit whatever it produced without a deploy
- the acceptance criterion in `docs/06-build-plan.md` is demonstrably met

Run `pnpm build` before you push — it is the exact command CI runs, and it is cheaper to
find a lint error here than in a failed pipeline.

---

## 9. When a rule and reality disagree

Sometimes the content, the brand and the code cannot all be satisfied at once. Three real
examples from this codebase, and what was done:

- The brand asks for three to five industry bands; the content has seven. **The content was
  not cut** — the bands ran shorter instead. Content is not yours to trim to fit a layout.
- Two snapshots named the same industry differently ("SaaS" and "SaaS and technology").
  **Neither was invented over** — the difference was recorded, the owner chose, and the test
  names the exception rather than hiding it.
- Removing the hero's photographs also removed the `#quote` anchor a call to action pointed
  at. **The test caught it, not a review.** When you remove something, search the whole
  repository for what pointed at it.

The pattern: when you cannot satisfy every rule, say so plainly, do the part that is not in
question, and let the owner decide the rest. Do not quietly pick one and move on.

---

## Where the detail lives

| Question | File |
| --- | --- |
| What we are building and why | `docs/00-project-brief.md` |
| How the system fits together | `docs/01-architecture.md` |
| What the content types are | `docs/02-content-model.md` |
| What sections a page has | `docs/03-page-specs.md` |
| What each page targets in search | `docs/04-seo-keyword-map.md` |
| Tokens and component inventory | `docs/05-design-system.md` |
| What to build next | `docs/06-build-plan.md` |
| Decisions taken, and why | `docs/08-decisions.md` |
| Budget maths and rules for marketing routes | `docs/09-performance.md` |
| Building a page family, and who owns which file | `docs/10-site-pages.md` |
| Deploying, and the server's own state | `docs/11-vps-deploy.md` |
| The admin dashboard | `docs/12-admin-dashboard.md` |
| The brand book | `calwebtech-design-system/README.md`, outside the repo |
