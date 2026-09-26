# 16. The service-by-city matrix — plan and questions

Written 2026-09-26 for task 6 of `docs/15-next-tasks.md` (build plan Task 3.2). **Nothing is
built yet.** The task starts with a plan and questions, because the docs disagree with each
other and with the site. This document covers:

1. what exists today;
2. where the docs and the site disagree;
3. one question per disagreement, with a recommendation;
4. the plan in mergeable steps, once the questions are answered;
5. what is out of scope, and what only the owner can supply.

Every statement about the code names the file it comes from. The questions are listed again,
on their own, at the end.

---

## 1. What exists today

### Services

- **Ten services**, in three categories (`apps/web/static-content/services/index.json`):
  - design and build: `custom-website-development`, `website-redesign`,
    `web-application-development`, `ecommerce-development`;
  - platforms: `nextjs-development`, `wordpress-development`, `shopify-development`;
  - growth and care: `ai-search-visibility`, `ai-integration`, `care-plans`.

  The dashboard may have added others in production since. These are the ten in the snapshot,
  and the deploy's import put them into production's database (decision 66).
- **Address:** `/services/<slug>/` (`servicePath` in `packages/shared/src/site-paths.ts`),
  rendered by `apps/web/app/(marketing)/(site)/services/[slug]/page.tsx`.
- **Storage:** `Service` rows (`packages/db/prisma/schema.prisma`). The row holds
  `answerBlock`, page copy in `content`, `seo`, `status`, `publishedAt` and `deletedAt`. The
  committed snapshots are `apps/web/static-content/services/<slug>.json`.
- **Reading:** database first. `getServicePage` in `apps/web/lib/api/services.ts` calls
  `findViewDatabaseFirst('services', …)` (`apps/web/lib/api/core.ts`). It asks the API first
  and falls back to the snapshot on a 404. Production names `services` in
  `CONTENT_DATABASE_FIRST` (decision 66), so the live service pages come from the database.
- **Editing:** `/admin/content/` and `/admin/content/services/<id>/`, through
  `apps/api/src/admin/services/`. Everything there needs the `content` module.
- **A slug change:** `AdminServicesService.update`
  (`apps/api/src/admin/services/admin-services.service.ts`) writes a `Redirect` row (301),
  from the old path to the new one. It does so in the same transaction, when the service was
  published or scheduled. `remove` writes one to `/services/`. Industries and case studies do
  the same (decision 58). What happens to those rows afterwards is in section 2, item 8.

### Cities

- **Two city pages and the index:**
  - `/locations/sacramento/` (Sacramento, CA);
  - `/locations/austin/` (Austin, TX);
  - `/locations/`.

  Both cities are `TIER_1`. They are the two offices in the approved homepage content
  (`apps/web/static-content/home.json`), and their street addresses come from
  `reference/homepage.html`.
- **Address:** `/locations/<slug>/` (`locationPath`), rendered by
  `apps/web/app/(marketing)/(site)/locations/[city]/page.tsx`.
- **Storage: snapshots only.** The pages live in `apps/web/static-content/locations/`
  (`index.json`, `sacramento.json`, `austin.json`). The `Location` model exists, and the API
  reads it (`apps/api/src/locations/`, `GET /pages/locations[/:slug]`). **Nothing writes a
  `Location` row:**
  - there is no `locations` importer family (`packages/db/src/import/index.ts`);
  - the seed writes only the index copy, on purpose (`packages/db/src/seed/pages/locations.ts`:
    "No location records are seeded");
  - there is no admin editor;
  - only `apps/api/src/locations/locations.integration.test.ts` creates a row.
- **Reading: snapshot, not database first.** `apps/web/lib/api/locations.ts` uses `findView`
  and `getView`. Production runs `CONTENT_SOURCE=snapshot` (decision 43) without `locations`
  in `CONTENT_DATABASE_FIRST` (decision 66), so both city pages render from the snapshot.
  Nothing in the repo writes a `Location` row to production's database either: production
  never seeds (decision 42), and the import writes none.
- **The sixty per cent rule exists as a function.** It is `locationUniqueShare` and
  `locationCompleteness` in `packages/shared/src/pages/locations.ts`. The measure:
  - the text is cut into runs of four words;
  - city and place names count as one word;
  - the share is the runs that no other city page repeats;
  - the minimum is 60%.

  The snapshot test uses it (`apps/web/static-content/locations/locations.test.ts`), and the
  API logs a warning with it. No editor warns with it, because none exists. No publish
  endpoint refuses with it either, although the function's comment says one does.
- **What the city pages link to.** Each page lists the services framed for its market
  (`LocationServicesSection` in `apps/web/components/locations/sections.tsx`). Each card
  links to `/services/<slug>/`:
  - Sacramento: website-redesign, custom-website-development, ecommerce-development,
    web-application-development, ai-search-visibility, care-plans;
  - Austin: nextjs-development, web-application-development, website-redesign,
    ecommerce-development, shopify-development, ai-search-visibility.
- **The local proof on both pages is demo proof.** That covers Verona Home, Truvia Labs, the
  case studies and Austin's testimonial, which the owner will replace (decision 66). The
  street addresses come from the mockup. The footer says "California" with no street address,
  because the owner gave none (docs/08, Open; docs/14).

### What the matrix would plug into

| Piece | Where |
|---|---|
| Sitemap | `apps/web/lib/sitemap-sources.ts`, one line per family. `sitemap.xml` and `/sitemap/` read it on every request. A source that throws fails the whole list (`lib/sitemap.ts`). |
| Structured data | `serviceJsonLd` in `apps/web/lib/seo/json-ld.ts` takes `serviceType` and `areaServed`. `locationJsonLd` is in `components/locations/structured-data.ts`. `FaqSection` adds FAQPage and `Breadcrumbs` adds BreadcrumbList. |
| Metadata | `sitePageMetadata` (`lib/seo/page-metadata.ts`): title 60, description 155, canonical, noindex while `site.indexing` is off. |
| RBAC | `packages/shared/src/auth.ts`, module `content`: OWNER and EDITOR full, VIEWER read, SALES none. |
| Audit | `AuditService.record` and `writeAudit` (decision 68); changed fields from `apps/api/src/common/changed-fields.ts`. |
| Admin editing | `components/admin/content/copy-editor.tsx` and `editor-parts.tsx`: copy as fields, shaped by the page's schema (decision 58). |
| Budgets | `apps/web/scripts/bundle-budget.mjs` measures every route on its own. Lighthouse CI measures only `/` and `/lp/b2b-website-design/` (`packages/perf/src/serve.mjs`). |
| CI data | The placeholder seed plus fixtures. There are no `Location` rows, so the city page e2e tests are skipped in CI as a "coverage gap" (`apps/web/e2e/locations.spec.ts`). |

### Of the matrix itself, nothing exists

- no model;
- no route;
- no family;
- no specification: `docs/02-content-model.md` has no content type for it, `docs/03-page-specs.md`
  has only a sitemap row, and `docs/04-seo-keyword-map.md` has no schema row.

---

## 2. Where the docs and the site disagree

Each item was checked against the files named.

1. **Nine pages or twelve.**
   - `docs/03-page-specs.md`, sitemap table: `/<service>/<city>/`, matrix template, launch
     records **9**.
   - `docs/06-build-plan.md`, 3.2: "Nine records at launch per `docs/04-seo-keyword-map.md`".
   - `docs/04-seo-keyword-map.md` crosses three services with four cities, which makes
     **twelve**, "as listed in `docs/03-page-specs.md`".

   `docs/03` lists no pairs, so each document points at the other and neither says which
   nine.
2. **`b2b-web-design` is not a service.**
   - It is not one of the ten, and has no `Service` row or snapshot.
   - The only B2B page is the campaign landing page `/lp/b2b-website-design/`
     (`static-content/landing-b2b-website-design.json`), which is noindex by default
     (`docs/03`).
   - `docs/04` maps "b2b web design agency" to cluster C, `/industries/<slug>/`, and none of
     the twelve industry snapshots is a B2B industry
     (`apps/web/static-content/industries/`).
3. **The cities.** `docs/04` crosses Sacramento, San Francisco, Los Angeles and San Diego.
   Only Sacramento has a page. The live city pages are Sacramento and **Austin**, which
   `docs/04` does not name for the matrix.
4. **The address.**
   - `docs/03` and `docs/04` write `/<service>/<city>/`, at the root.
   - Services live at `/services/<slug>/` (`servicePath`).
   - Every family's routes sit in its own folder (`docs/10-site-pages.md`, "File ownership").

Found while checking:

5. **Austin's tier.** `docs/04` puts Austin in Tier 3, "published only once a client in that
   market can be named". The site publishes Austin as `TIER_1`, because it is an office in the
   approved homepage. The client its page names, Truvia Labs, is demo proof (decision 66).
6. **No specification for the page.**
   - `docs/03` has no section list for the matrix template.
   - `docs/04`'s "Schema per template" has no matrix row.
   - `docs/02` and `docs/12-admin-dashboard.md` (section 6's list of types) have no content
     type for it.

   docs/15 points at `docs/03` for the structured data, and `docs/03` has none for this
   template.
7. **The matrix needs a location in the database, and production has none.**
   - A matrix record is "one service and one location" (docs/15).
   - Services are rows in production. The two cities are snapshots only (section 1).
   - Locations have no editor. Task 3.1's "sixty per cent uniqueness rule as an editor
     warning" exists as the shared function and the snapshot test, not as an editor.
8. **Redirects are written but never served.**
   - Three admin services create `Redirect` rows: services, industries and case studies.
   - Nothing reads them. `.redirect.` appears in the code only in `create` calls and in
     tests. No web route, proxy or API endpoint looks them up.
   - So a moved address does not redirect. It answers 404, or, for a database-first family,
     the old snapshot page: `findViewDatabaseFirst` falls back to the snapshot on a 404.
   - `Redirect.fromPath` is unique. So moving a slug A → B → A → B fails on the second
     A → B. And A → B → A leaves the rows `/A/ → /B/` and `/B/ → /A/`, a loop once they are
     served.
9. **The sixty per cent rule: a warning or a gate.**
   - `docs/04` sets the rule for city pages ("per city").
   - docs/15 asks the matrix editor to *warn* below sixty per cent difference from the parent
     service or location.
   - The build plan's gate says *no* matrix page duplicates its parents.

   A warning alone does not guarantee the gate.

---

## 3. Questions for the owner

Each question has a recommendation and the reason for it. Nothing is built until they are
answered.

**Q1. The address.** Is it `/services/<service>/<city>/` or `/<service>/<city>/`?
*Recommendation: `/services/<service>/<city>/`,* for example
`/services/ecommerce-development/sacramento/`.
- The page sits under its parent, and its breadcrumbs read Services › Ecommerce development ›
  Sacramento.
- A root-level `/<service>/<city>/` route would catch every two-segment path the site does not
  otherwise have.
- A service's slug could collide with a top-level page.
- `docs/03` and `docs/04` are corrected in the same PR.

**Q2. How many pages at launch?**
*Recommendation: no target number.*
- A matrix page exists only where there is something real to say (docs/15; `docs/04`,
  "Publish only where there is something real to say").
- The machinery ships with none published.
- Nine can stand as a ceiling for the first round. It is not a quota to fill.
- `docs/03`, `docs/04` and `docs/06` are corrected to say this.

**Q3. What happens to `b2b-web-design`?**
*Recommendation: drop it from the matrix. Do not create a service for it, and do not
substitute a broad service.*
- B2B web design is a campaign page and, in `docs/04`, an industry cluster.
- A broad service crossed with a city ("custom website development Sacramento") would compete
  with the city page's own query, "web design agency sacramento". `docs/04` says no two pages
  target the same primary query.
- If the owner wants a third service, choose a specialist one: Shopify, Next.js or web
  application development.

**Q4. Which cities?**
*Recommendation: only the cities that have a published city page, which today means
Sacramento and Austin.*
- A matrix page needs its parent city page, both to link up to and to be measured against.
- San Francisco, Los Angeles and San Diego come later, each as a city page first, under
  Task 3.1's rules.
- For Austin, the recommendation is to allow it as a parent, with no Austin matrix page until
  the owner can name a real Austin client or fact. `docs/04`'s tier list is then corrected to
  match the offices.

**Q5. Which pairs have something real to say?** This is the owner's call. The candidates:
- `ecommerce-development` × Sacramento:
  - a `docs/04` target;
  - both parents exist;
  - the Sacramento page already frames ecommerce for its market.
- `wordpress-development` × Sacramento:
  - a `docs/04` target;
  - but the Sacramento page does not mention WordPress, so it needs real local WordPress work
    behind it.
- `ecommerce-development` × Austin:
  - the Austin page frames ecommerce;
  - not a `docs/04` target.

*Recommendation:* build the machinery. For each pair the owner picks, the owner supplies the
local facts (section 5), and nothing is published until then.

**Q6. May the two city pages be imported into the database?** Production has no `Location`
rows, and a matrix record must point at one.
*Recommendation: yes. Add a `locations` importer family, like decision 58's, with a test that
the API's view of each city equals its snapshot.*
- It writes Sacramento and Austin: record, copy, FAQs and SEO. It writes only where no row
  exists, so later edits are never overwritten.
- It does **not** switch the city pages to the database. They keep rendering from the snapshot
  until the owner adds `locations` to `CONTENT_DATABASE_FIRST`.
- The equality test will show whether both pages can be rebuilt from rows. Decision 43 found
  hand-written views that could not. If a section cannot be rebuilt, the test names it and
  the owner decides.
- A location editor, and with it Task 3.1's editor warning, is a separate task. Until one
  exists a city's slug cannot change, so no redirect is needed for it.

The alternative is to store the city as a bare slug. It is not recommended: there would be no
foreign key, the difference check would have to read snapshot files, and it would break when
locations move into the database.

**Q7. Should stored redirects be served, and for which families?**
*Recommendation: yes. Build it once, as the first step, and use it for all four families.*
- The matrix and services, industries and case studies use it in the same PR, because
  none of them redirects today.
- When a page's record is not found, the page asks the API for a stored redirect before it
  renders the 404. For a database-first family, it asks before the snapshot fallback.
- The web gets it through a small read-only API endpoint. It adds no cost to pages that
  exist.
- Next.js answers a permanent redirect with **308**. Search engines treat it like 301. A
  literal 301 would mean a check in the web server's proxy layer on every request, which is
  not worth it.
- The writer also:
  - replaces an existing redirect from the same path instead of failing;
  - deletes one whose path is live again;
  - points older redirects at the newest address, so no chain or loop forms.

**Q8. Is the sixty per cent rule a warning or a refusal?**
*Recommendation: both.*
- The editor warns while the owner writes.
- The API refuses to publish below sixty per cent and gives the reason, as it refuses an
  incomplete case study (decision 58). The build plan's gate is that no matrix page duplicates
  its parents, and only a refusal makes that true.
- Also measure against the other matrix pages for the same service or the same city. `docs/04`
  names the failure: "cloned copy with a swapped city name".

**Q9. What sections does the page have, and what structured data?** `docs/03` gives none.
*Recommendation: the list below. Every section uses a form the site already has (RULES.md,
section 1), and a section with nothing real in it is left out.*
- **Hero:**
  - the H1, by default "<Service> in <City>";
  - the answer block straight under it;
  - a short introduction;
  - "Get a quote" pre-filled with the service, and "Book a consultation".
- **Local context:** what is different about this service for businesses in this city, under
  headings written as questions.
- **Local proof:** up to three published case studies the owner picks. Only real ones.
- **Working with us in the city:** one line and a link to the city page, not a copy of it.
- **FAQs:** three to five local questions.
- **Links up:** the service page, the city page, and the other published matrix pages in the
  same city. No other cities: `docs/04` says "never two cities on one page".
- The site's closing band.
- **No price.** The service page carries it; the matrix links to it.
- **Structured data:**
  - a `Service` node with `serviceType` (the parent service), `areaServed` (the city) and the
    Organization as provider;
  - FAQPage and BreadcrumbList;
  - no Offer, because the page states no price;
  - no Review or AggregateRating.

**Q10. Where do the parent pages link to the matrix?** This decides the form of a section, so
it is the owner's.
*Recommendation:*
- **City page:** a service card whose service has a published matrix page in that city links
  to the matrix page instead of the generic service page. There is no new section.
- **Service page:** a short list, "Where do we deliver <service> locally?", in the row form of
  the existing related-services section. It appears only when at least one matrix page is
  published.
- With none published, both pages render exactly as they do now.

**Q11. What is the family called?**
*Recommendation: `service-locations`,* after the model `ServiceLocation`. It has no snapshot.
Its getter reads the API only when:
- `CONTENT_SOURCE=snapshot` (production today) and `CONTENT_DATABASE_FIRST` names
  `service-locations`; or
- `CONTENT_SOURCE=api`, as in development, CI and staging.

Otherwise, and on the Vercel demo with no API:
- the matrix route answers 404;
- the sitemap source returns nothing;
- the parent pages link to no matrix page.

The owner adds the name to production's `CONTENT_DATABASE_FIRST` after the deploy.

---

## 4. The plan, once answered

Each step is one PR and is inert on its own. Until the owner creates and publishes a record,
production shows nothing new. A step marked with a question depends on that answer.

### Step 1 — Serve stored redirects (Q7)

- **API:** a read-only lookup, `GET /pages/redirects?path=`. It has no rate limit and is
  cached like the other page views.
- **Web:** a getter, `findRedirect(path)`. The matrix page calls it before `notFound()`. With
  Q7's yes, so do the service, industry and case study pages; the service page calls it
  before its snapshot fallback.
- **One redirect writer** for the admin services: replace instead of fail, remove a redirect
  whose path is live again, re-point older redirects, no chains or loops.
- **Verified:**
  - integration tests: A → B → A → B saves each time and leaves no loop; a moved service
    address answers 308 to the new one;
  - an e2e check on a fixture service.

### Step 2 — The city pages into the database (Q6)

- A `locations` importer family (`packages/db/src/import/locations.ts`), appended to
  `IMPORTERS` after `case-studies`, because a city page names case studies and services.
- It writes only where no row exists.
- The city pages keep rendering from the snapshot.
- **Verified:**
  - an integration test that the API's view of each imported city equals its snapshot, with
    any exception named, as `industries-import` does;
  - a second run changes nothing;
  - `locations.test.ts` is unchanged.

### Step 3 — The content type, the migration and the contract

- **A forward-only migration** adds a `ServiceLocation` table, and a nullable
  `Faq.serviceLocationId` so the page's FAQs are ordinary `Faq` rows, as on service and city
  pages. It loses no history.

  | Field | What it is |
  |---|---|
  | `serviceId` → `Service`, `locationId` → `Location` | The parents. Fixed once created: to change a pair, create the new one and remove the old one, which leaves its redirect. `@@unique([serviceId, locationId])`: one page per pair. |
  | `title` | The H1, by default "<Service> in <City>". |
  | `answerBlock` | Two to three sentences, validated by `answerBlockSchema`. |
  | `content` Json | The local sections, the picked case studies (by slug), an optional image with alt text. Validated by the family's schema. |
  | FAQs | `Faq` rows with `serviceLocationId`. |
  | `seo` Json | `seoSchema`: title up to 60, description up to 155, canonical override, OG image. |
  | `status`, `publishedAt` | As on `Service`: draft, scheduled, published, archived. |
  | `createdAt`, `updatedAt`, `deletedAt` | CLAUDE.md. Removal keeps the row. |

  The page's address is derived, `/services/<service slug>/<city slug>/`. It has no slug of
  its own, so it moves only when a parent's slug moves.
- **Shared contract.** `packages/shared/src/pages/service-locations.ts` holds:
  - the view schema, the content schema and the admin input schema;
  - a path helper, `serviceLocationPath`, in `site-paths.ts`;
  - the readiness check below.
- **How the difference is measured.** The check reuses the measure the city pages already
  use: runs of four words, lower-cased, with city, state and service-area place names folded
  into one token (`locationUniqueShare`).
  - The matrix page's body copy is every paragraph, list item and FAQ a visitor reads. It
    leaves out the headings, labels and calls to action the template repeats.
  - It is compared with the parent service page's body copy (a new `serviceBodyCopy`, built
    like `locationBodyCopy`).
  - It is compared with the parent city page's body copy (`locationBodyCopy`).
  - It is compared with the other matrix pages that share its service or its city.
  - The page's own share is the runs found in none of them. The minimum is 60%.
  - The editor shows the share against each one as well, so the owner knows which page it
    repeats.
  - It measures copied wording, not meaning. A paraphrase of the service page passes, so the
    owner's reading stays the real check.
- **Readiness to publish:**
  - an answer block;
  - at least one local section;
  - three to five FAQs;
  - SEO within its limits;
  - both parents published;
  - a unique share of at least 60% (Q8).
- **Verified:** unit tests:
  - a page cloned from another with the city swapped scores about 0;
  - a page built from the service page's paragraphs scores under 60%;
  - a page of its own scores 100%;
  - the schemas refuse what they must.

### Step 4 — The public page

- **API:** `apps/api/src/service-locations/`.
  - `GET /pages/service-locations` lists the published pairs, for the sitemap and the links.
  - `GET /pages/service-locations/:service/:city` returns one page.
  - Both use a 30-second `ViewCache`.
  - "Published" means the page is published as of now and not removed, its service is
    published and not removed, and its city is published. A parent that goes off the site
    takes its matrix pages with it.
- **Web:** `lib/api/service-locations.ts`, which returns nothing with the family off (Q11).
  - The route is `app/(marketing)/(site)/services/[slug]/[city]/page.tsx`.
  - Its sections are in `components/service-locations/`.
  - Metadata comes from `sitePageMetadata`, with the canonical on the page itself and noindex
    while `site.indexing` is off.
  - Structured data is as in Q9.
  - One line is added to `lib/sitemap-sources.ts`. The pages are listed under "Services" in
    `/sitemap/`.
- **A fixture pair** in `PAGE_FIXTURES`, for development and CI only. It needs a published
  fixture `Location`, which `home.spec.ts` must then accept. `locations.spec.ts` names this
  coverage gap.
- **Verified:**
  - unit tests for the mapper, the JSON-LD builder, and the getter both on and off;
  - an API integration test;
  - `e2e/service-locations.spec.ts`: one `h1`, the answer block first, the breadcrumbs, the
    FAQ, noindex, no console errors;
  - in Chrome at 360 and 1440: no overflow, and the whole page by keyboard;
  - the own-JS budget, measured for the new route automatically;
  - Lighthouse run by hand against the fixture page, because CI measures two other pages.

### Step 5 — The admin editor

- **API:** `apps/api/src/admin/service-locations/`, all under `@RequireModule('content', …)`.
  - list and detail;
  - create: pick a service and a city from the database; a new page is always a draft;
  - update;
  - publish and schedule, refused with reasons when a page is not ready;
  - unpublish;
  - remove, which leaves a 301 to the parent service page if the page was live.
- **Audited:** `service_location.created`, `.updated`, `.published`, `.scheduled`,
  `.unpublished` and `.deleted`, with the fields that changed.
- **Web:** `/admin/content/service-locations/`, a list and an editor, using the copy editor
  and `editor-parts.tsx`, in the dashboard's visual system (decision 63):
  - the answer block with its sentence guidance;
  - the local sections as fields;
  - FAQs that can be added, reordered and removed;
  - a picker for published case studies;
  - the image with alt text;
  - the SEO panel with live counters;
  - the publishing panel, which shows the page's address;
  - the difference panel: the share against the service, against the city, against the other
    matrix pages, and in total. The API computes it on every save, so no parent text is sent
    to the browser.

  The editor says the page is live only once the `service-locations` family is on.
- **Verified:**
  - integration tests:
    - RBAC: SALES is refused, VIEWER reads only, EDITOR and OWNER write;
    - an audit row for every change;
    - publishing is refused below 60%, without FAQs, and with a parent unpublished;
    - removal leaves the 301;
  - unit tests for the editor;
  - in Chrome at 360 and 1440: every control labelled, errors under their fields, no
    overflow, everything reachable by keyboard;
  - the own-JS budget on the new admin routes.

### Step 6 — Redirects when a parent's slug changes

- When a published service's slug changes, `AdminServicesService.update` writes, in the
  same transaction, a 301 for each published matrix page under it (old service slug → new).
- When a service is removed, its matrix pages are removed with it. Each live one leaves a 301
  to its city page.
- The same will apply to a city once a location editor exists (Q6).
- **Verified:** integration tests for both cases, and the moved address answering through
  step 1.

### Step 7 — Links from the parent pages (Q10)

- The link getters read `GET /pages/service-locations` and return nothing with the family
  off. That works whether the parent page renders from the database or from a snapshot, so
  the city pages need not move into the database first.
- **Verified:**
  - unit tests: with no published pairs, both parent pages render exactly as today;
  - with the fixture pair, the city card and the service list link to it;
  - in Chrome at 360 and 1440, and by keyboard.

### Step 8 — The docs

- `docs/08-decisions.md`: a decision for the answers and the design.
- `docs/02`: the content type.
- `docs/03`: the template, its sections, the address and the launch rule.
- `docs/04`: the address, the launch list, the Austin tier, and the schema row.
- `docs/06`, 3.2: the wording.
- `docs/10`: the family and its folders.
- `docs/12`: the list of types.
- The env examples: a comment naming `service-locations`.

The PR names the family. It changes no words in a database-first family, so it lists no
dashboard edits.

---

## 5. Out of scope, and what the owner supplies

**Not in this task:**

- Writing or publishing any matrix page's copy. **No invented local content.**
  - The launch seed gets no matrix rows.
  - The fixtures are for development and CI only.
  - Any draft offered to the owner is an outline: headings written as questions, and the fact
    each one needs. It contains no local claims.
- Any edit in production: in the dashboard, to the env file, or with `settings-cli`.
- New city pages (San Francisco, Los Angeles, San Diego and the other tiers).
- A B2B service or a B2B industry.
- A location editor, and Task 3.1's editor warning (Q6).
- Matrix pages in site search (decision 62), in `llms.txt`, on the homepage and on
  `/locations/`.
- Adding the matrix to the Lighthouse CI page list.

**Only the owner can supply:**

- the answers to the questions below;
- for each pair chosen, the real local facts:
  - clients in that city who bought that service and may be named;
  - the local case study;
  - what is genuinely different about that market for that service;
  - how the work is delivered there;
  - the questions local buyers actually ask;
  - an image with alt text, if wanted;
  - the SEO title and description;
- confirmation that the two office addresses on the site are real, and whether Austin stays
  in the first tier;
- after the deploy:
  - `service-locations` added to production's `CONTENT_DATABASE_FIRST`;
  - the import allowed to run the new `locations` family, as it ran the others (decision 66);
- writing and publishing the pages from the dashboard.

---

## The questions, in one list

1. **Address:** `/services/<service>/<city>/`? *(Recommended.)*
2. **How many:** no target, only pairs with something real to say, nine at most in the first
   round? *(Recommended.)*
3. **`b2b-web-design`:** drop it, with no broad service in its place? *(Recommended.)*
4. **Cities:** only those with a city page, Sacramento and Austin, and no Austin matrix page
   until a real Austin client can be named? *(Recommended.)*
5. **Pairs:** which ones? Candidates: ecommerce × Sacramento, WordPress × Sacramento,
   ecommerce × Austin.
6. **Locations import:** import the two city pages into the database, without switching the
   pages over? *(Recommended.)*
7. **Redirects:** serve stored redirects, for services, industries and case studies too?
   *(Recommended.)*
8. **Sixty per cent:** warn in the editor and refuse to publish below it, measured against the
   parents and the sibling matrix pages? *(Recommended.)*
9. **Sections and structured data:** as proposed in Q9?
10. **Parent links:** city cards link to the matrix page, and a short list on the service
    page? *(Recommended.)*
11. **Family name:** `service-locations`? *(Recommended.)*
