# 12. Admin dashboard (Task 5.3)

The plan for the admin: what it contains, in what order it is built, and what the owner
must decide first. Read `docs/06-build-plan.md` (Task 5.3) and `docs/02-content-model.md`
before starting; this file turns them into a build.

Written on 2026-09-20, the day production went live on the VPS. Part A is the screen
inventory, written so it can be handed to a designer on its own. Part B is the backend,
which is built first and does not wait for the design.

---

## Why this is two problems, not one

The admin needs both halves before a non-developer can publish anything:

1. **The admin itself** — identity, sessions, RBAC, and a write API and editor per type.
2. **Content in the database.** Production runs `CONTENT_SOURCE=snapshot`
   (decision 43): every page renders from the JSON committed in
   `apps/web/static-content`. The live database holds **0 services, 0 posts, 0 projects**.
   An editor built today would open onto empty lists.

The second half is the one that is known to be hard. `wip/content-import-views` tried to
import every snapshot at once and could not: the homepage and landing snapshots are
hand-written mockups whose values no mapper produces, and the snapshots contradict each
other about shared records. It has to be done **one family at a time**, each needing
mapper work and an editorial decision from the owner per conflict.

So the order is: build the admin against the data that is already real (leads), then move
content families into the database one by one, each with its own editor and importer.
A family flips to `CONTENT_SOURCE=api` only when its API view equals its snapshot.

---

## Roles

`Role` already exists in the schema: `OWNER`, `EDITOR`, `SALES`, `VIEWER`. The gate in
`docs/06-build-plan.md` is that each role reaches exactly its modules and nothing more,
enforced **server-side on every route**, never by hiding buttons.

| Module | OWNER | EDITOR | SALES | VIEWER |
|---|---|---|---|---|
| Overview | full | full | full | read |
| Leads inbox | full | — | full | read |
| Bookings | full | — | full | read |
| Subscribers, segments, tags | full | — | full | read |
| Campaigns, automations | full | — | full | read |
| Content manager (all types) | full | full | — | read |
| Media library | full | full | — | read |
| Page sections | full | full | — | read |
| Forms and routing | full | full | — | read |
| Team and roles | full | — | — | — |
| Settings | full | — | — | — |
| Audit log | full | — | — | — |
| Export | full | full | full | — |

"read" means the listing and the detail, with every write control absent and every write
route refused. A VIEWER must not see lead email addresses in export form.

---

# Part A — The screens

This part is self-contained: it can be handed to a designer without the rest of the file.

## Shell

Persistent left sidebar with the module groups below, a top bar carrying breadcrumb,
global search, the signed-in user and sign-out. Collapses to a drawer under 1024px.
Every screen works at 360px and 1440px.

Groups: **Overview** · **Sales** (leads, bookings, subscribers, campaigns) ·
**Content** (each type, media, page sections) · **Site** (forms and routing, settings) ·
**Admin** (team and roles, audit log).

## 1. Overview

Leads this week, this month, and their trend; leads by status; leads by source and
campaign; latest five leads; recently edited content; queue and email health; anything
that needs attention (drafts scheduled in the past, images missing alt text, content
referencing deleted records).

## 2. Leads inbox — *the first screen to design*

One table for every capture point, because `Lead` is one table with a `type`
discriminator (`docs/02-content-model.md`). This is the only module with real data today.

- **Filters**: type, status, owner, date range, source or campaign, service, enquiry type.
- **Columns**: received, name, company, type, service or campaign, status, owner, value
  band. Sortable, paginated, keyboard-navigable.
- **Bulk**: assign owner, change status, export selection, tag.
- **Detail panel or page**:
  - Identity: name, email, phone, company, linked `Contact` so one person appearing
    through three forms is one record.
  - What they submitted, per type — the eight calculator answers, the brief's project
    type and links, the audit's site URL and main concern, the contact form's enquiry type.
  - **Attribution trail**: first touch, last touch, UTM set, referrer, landing page,
    campaign (`LeadAttribution`).
  - **Pipeline**: status (`LeadStatus`) with a reason on change, owner, next action date.
  - **Timeline**: `LeadActivity` and `LeadNote` interleaved, newest first, each stamped
    with who and when. Notes support mentions of team members.
  - Emails sent to this lead and their delivery state.
- **Empty state** matters: a new production database has no leads.

## 3. Bookings

Calendar and list of `Booking` with consultation type, slot, timezone, status, and the
lead it belongs to. **Blocked**: Task 5.1 was lost in the SSD failure and is not rebuilt,
so design it but expect it to ship after the booking API exists.

## 4. Subscribers, segments and tags

Subscriber list with source, consent state, tags, and suppression status shown separately
from subscription state — an unsubscribe can never be undone by an import. Segment
builder producing a rule set that is re-evaluated at send time, with a live count.

**Built** (Task 5.4, first part; `docs/08-decisions.md`, 49): `/admin/subscribers/` with
search and status and tag filters, a subscriber page with its tags,
`/admin/subscribers/segments/` with the builder and its live count, and
`/admin/subscribers/suppression/`, where an address can be added by hand and never
removed. Contract in `packages/shared/src/audience.ts`, API in `apps/api/src/admin/audience/`.
Nothing creates subscribers yet (see decision 49's Open entry).

## 5. Campaigns and automations

Campaign list and composer, template picker, personalisation tokens with fallbacks, test
send, schedule, and per-campaign reporting. **Deferred to Task 5.4**; design last.

**Built so far** (`docs/08-decisions.md`, 50): the campaign list with a status filter, and
the composer at `/admin/campaigns/[id]/` with name, subject, preview text, template, segment
and a block body, a live preview of unsaved content, and a test send to the team. Scheduling,
sending now, the send's progress and the public unsubscribe page followed (decision 51), then
Resend's delivery webhook and the per-campaign report at `/admin/campaigns/[id]/report/`
(decision 52). Automations are not part of Task 5.4 and are not built.

## 6. Content manager — one pattern, nineteen types

Every type in `docs/02-content-model.md` gets the same three screens, so design the
pattern once and list the fields per type:

- **Listing**: search, filter by status and category, sort, reorder where `order` exists,
  bulk publish, unpublish, delete. Columns: title, status, updated, author.
- **Editor**: the type's own fields (the table in `docs/02-content-model.md` is the
  authority), plus three panels every type shares:
  - **Publishing**: draft, scheduled, published; `publishedAt`; preview URL for drafts.
  - **SEO**: title (under 60 chars, counted live), description (under 155, counted live),
    canonical override, OG image, and a preview of the search and social result.
  - **Answer block**: the two to three sentence direct answer that opens every service,
    industry, location, glossary and article template. Not optional — it is the extraction
    target for AI answer engines. Show its own character guidance.
- **Slug field**: auto-generated from the title, uniqueness-checked, editable. Changing a
  published slug creates a permanent redirect automatically and says so in the UI, with
  the old and new path shown. Never silent.
- **Delete**: warns when the record is referenced and never leaves a broken public page.

Types, in the order they should be built: Service and ServiceCategory, Project,
Testimonial, Post and PostCategory, Faq, TeamMember, Technology, Industry, Location,
GlossaryTerm, Guide, Award, Partner, Statistic, ProcessStep, PricingTier, ClientLogo,
JobOpening, Demo, LandingPage.

Two need more than a text field: `Post.body` is MDX, and several types hold a `content`
JSON validated by the family's schema in `packages/shared`. The editor for those needs a
block or field-group UI, not a raw JSON textarea.

## 7. Media library

Grid and list, search, filter by type and usage. Upload with drag and drop.
**Alt text is required at upload — the library rejects an image without it.** Shows
dimensions, generated responsive variants, who uploaded it, and where it is used
(`usageRefs`), so nothing in use is deleted by accident.

## 8. Page sections

`PageSection` by `sectionKey` (`home.hero`, `global.announcement`): heading, subheading,
body, media, CTA label and URL, visible. This is how the announcement bar and static
blocks change without a deploy.

## 9. Forms and routing

`EnquiryType` list: label, slug, destination mailbox, whether it is offered on the contact
form, order. This is live data today — the import wrote six of them. Plus the
success copy each form shows, and the per-form notification recipients.

## 10. Team and roles

User list with role, last sign-in, and active sessions that can be revoked. Invite by
email. A user is soft-deleted, never removed, so audit history keeps its author.

## 11. Settings

The five keys that `settings-cli` changes today — `site.contact`, `site.proof`,
`leads.notificationRecipients`, `homepage.indexing`, `site.indexing` — plus the indexing
switches presented as what they are: "show this site to search engines". Every change
writes an audit entry, which `settings-cli` does not do today.

## 12. Audit log

Filterable by user, action, entity type and date, with a before and after diff. Required
on every admin login, content change, lead status change, export and campaign send.

## 13. Export

CSV and Excel for leads, subscribers and any content listing, honouring the current
filter. Every export writes an audit entry naming who exported what.

## Design constraints

- **Tokens only**, from `packages/config/tailwind/theme.css`. Lint rejects raw hex in
  `apps/web`: `ink #0A1D37` · `primary #1550E0` · `result #0E9F87` · `mist #EEF3F9` ·
  `mist2 #F7FAFD` · `line #DCE4EE` · `body #41536B`.
- **Teal (`result`) is reserved** for outcome figures and affirmative marks — check icons,
  status dots. It is banned from headings, body text, buttons, links, borders and card
  backgrounds, and the `calwebtech/teal-usage` lint rule enforces this in `apps/web`,
  which is where the admin lives. Status pills therefore carry teal only as a dot or mark,
  never as a filled background.
- Display face Plus Jakarta Sans, body face IBM Plex Sans.
- **WCAG 2.2 AA**: visible focus states, full keyboard operability including the tables and
  the editor, semantic landmarks, correct heading order, labelled inputs with described
  errors. A dashboard is a keyboard tool before it is a mouse tool.
- Motion is opacity and transform only, nothing that shifts layout, and respects
  `prefers-reduced-motion`.
- Dense but not cramped: this is a working tool, not a marketing page. Tables should show
  many rows without scrolling on a 1440px screen.
- The admin shell is **not** the marketing chrome. It shares tokens and type, nothing else.

---

# Part B — The backend, built first

None of this waits for the design. Every schema lives in `packages/shared`, every route is
validated with Zod, and `apps/web` never touches Prisma — the admin UI calls the API like
every other part of the site.

### B1. Identity and sessions
`argon2id` hashing. First-party session cookie: `httpOnly`, `Secure`, `SameSite=Strict`,
no Auth.js and no external auth service. `Session` rows carry IP and user agent so they can
be listed and revoked. Routes: sign in, sign out, sign out everywhere, current user.
Rate limit sign-in per IP **and per account**, and keep the timing of a wrong password
indistinguishable from an unknown address.

### B2. CSRF and RBAC
CSRF protection on every mutation. A roles guard applied at the controller, defaulting to
deny, so a new admin route is unreachable until its role is declared. The permission matrix
above becomes a test, not a convention.

### B3. Audit log
An interceptor writing `AuditLog` with before and after for every admin mutation, plus
explicit entries for sign-in, export and campaign send. Move `settings-cli` onto the same
path so its changes stop being invisible.

### B4. The first account
A production database has no users. A one-off CLI in the API image, like
`settings-cli`, creating the first `OWNER` with a password read from a prompt, refusing to
run when any user already exists.

### B5. Leads API
List with filters, sort and pagination; detail with attribution and timeline; status
change with reason; owner assignment; notes; CSV and Excel export. This is where the admin
becomes useful on day one, because the data is already there.

### B6. Content write API, per type
Create, update, publish, schedule, unpublish, soft delete, reorder. Shared behaviour built
once: slug generation and uniqueness, **automatic `Redirect` on a published slug change**,
status and `publishedAt` transitions, SEO validation against the length rules, answer-block
presence where the template requires it, and a referenced-record check before delete.

### B7. Media
Upload, validation, conversion to modern formats, responsive variants, **alt text required**
or the upload is refused, and `usageRefs` so deletion is safe. The `media` volume is already
mounted on the server and empty.

### B8. Snapshot to database, family by family
For each family: extend the mapper, write the importer, and add a test asserting the API
view equals the snapshot. When it passes, that family can read from the database. Start with
**Service**, which is the owner's stated goal and the least entangled. `home.content` and the
landing page are last, because they are hand-written views (see `wip/content-import-views`).

---

## Milestones

| # | Milestone | Contains | Useful on its own? |
|---|---|---|---|
| M1 | Sign in and see leads | B1–B5, shell, leads inbox, overview | Yes — today leads are invisible without `psql` |
| M2 | Operate without SSH | Settings, audit log, team and roles, forms and routing | Yes — retires `settings-cli` |
| M3 | Media | B7, media library | Blocks M4 |
| M4 | Publish a service without a deploy | B6 and B8 for Service, its editor, `CONTENT_SOURCE=api` for that family | **This is the goal** |
| M5 | The rest of the content types | Remaining types, page sections | Yes |
| M6 | Sales beyond leads | Subscribers, segments; bookings once Task 5.1 exists | Feeds Task 5.4. Subscribers, segments and suppression built (decision 49) |

M1 is the one to design first, and M4 is the one the owner asked for.

---

## Decisions needed before building

1. **The performance budget covers every route.** `pnpm --filter @calwebtech/web budget`
   walks the whole route manifest with no marketing filter, so the 20 kB own-code gate
   will apply to admin routes too and a real dashboard will breach it. The budget exists
   to protect acquisition pages; the admin is authenticated and noindex. Choose: exclude
   the `(admin)` group from the gate, give it its own larger budget, or hold the admin to
   20 kB and accept a server-rendered, minimally interactive UI. **A separate, larger admin
   budget is the recommendation** — marketing stays protected and admin growth stays visible.
2. **Session lifetime and idle timeout**, and whether a second factor is wanted. The
   original spec does not mention 2FA.
3. **Media storage**: the mounted `media` volume on the VPS, or object storage. The volume
   is simpler and already backed up; object storage survives the server.
4. **`Post.body` is MDX** in the content model. Confirm whether editors write MDX, or
   whether a rich text editor stores a structured document instead.
5. **Who gets accounts, and at which roles**, for the first release.

---

## What is deliberately not here

Campaigns and automations are Task 5.4 and are only sketched above. Bookings wait on Task
5.1. The public site does not change in this task except where a family moves to
`CONTENT_SOURCE=api`. Indexing stays off until the demo proof is replaced with real
content, whatever the admin can switch.
