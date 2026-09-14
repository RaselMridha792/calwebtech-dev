# 10. Site Pages

Read this before building any page under `apps/web/app/(marketing)/(site)/`. Six page
families build on the foundation described here at the same time. The rules exist so no
family edits another family's files, and an integrator can merge them with one-line
conflicts only. `CLAUDE.md` is still the contract; this file says how it applies to the
site pages. Decisions 34 to 41 in `docs/08-decisions.md` record why.

## Families

| Family | Routes |
|---|---|
| `services` | `/services/`, `/services/<slug>/` |
| `industries` | `/industries/`, `/industries/<slug>/` |
| `work` | `/work/` with URL filters, `/work/<slug>/`, `/before-and-after/` |
| `company` | `/about/`, `/team/`, `/testimonials/`, `/awards/`, `/partners/`, `/technology/` |
| `static` | `/pricing/`, `/process/`, `/contact/` with a contact form, `/faq/`, `/thank-you/<type>/`, `/privacy-policy/`, `/terms/`, `/cookie-policy/`, `/accessibility/`, `/information-security/`, the designed not-found and error pages |
| `locations` | `/locations/`, `/locations/<city>/` |

## File ownership

A family creates and edits only the files it owns. Everything else belongs to the
foundation: if a family needs a change there (a Prisma field, a shared component, a new
image host, a setting in `settings-cli`), it says so in its report instead of making it.

### What each family owns

`<family>` is the family name from the table above.

| Path | Holds |
|---|---|
| `packages/shared/src/pages/<family>.ts` and its `.test.ts` | the family's view schemas and types, and its setting keys |
| `apps/api/src/<family>/` | controller and module, service, mapper, mapper tests |
| `apps/web/app/(marketing)/(site)/<route>/` for the family's routes (below) | pages |
| `apps/web/components/<family>/` | the family's sections and its structured data builders |
| `apps/web/lib/api/<family>.ts` | the family's getters and `sitemapEntries()` |
| `apps/web/static-content/<family>/` | view snapshots, their `index.ts` and snapshot test |
| `apps/web/e2e/<family>.spec.ts` | end-to-end tests |
| `packages/db/src/seed/pages/<family>.ts` and its `.test.ts` | placeholder rows and end-to-end fixtures, if the family needs any |

Route folders, all under `apps/web/app/(marketing)/(site)/`:

| Family | Folders |
|---|---|
| `services` | `services/` |
| `industries` | `industries/` |
| `work` | `work/`, `before-and-after/` |
| `company` | `about/`, `team/`, `testimonials/`, `awards/`, `partners/`, `technology/` |
| `static` | `pricing/`, `process/`, `contact/`, `faq/`, `thank-you/`, `privacy-policy/`, `terms/`, `cookie-policy/`, `accessibility/`, `information-security/`, `not-found.tsx`, `error.tsx`; and outside the group `apps/web/app/not-found.tsx` and `apps/web/app/global-error.tsx` |
| `locations` | `locations/` |

### Shared registration points

Each family appends to these, below the marker comment, and nothing else in them. The
integrator merges the lines.

| File | What to append |
|---|---|
| `packages/shared/src/index.ts` | `export * from './pages/<family>';` |
| `apps/api/src/app.module.ts` | one import line below the import marker, and the module below the `imports` marker |
| `apps/web/lib/sitemap-sources.ts` | `() => import('@/lib/api/<family>').then((module) => module.sitemapEntries()),` |
| `packages/db/src/seed/pages/index.ts` | `() => import('./<family>').then((module) => module.<family>Seed),` in `PAGE_SEEDS`, and the same for fixtures in `PAGE_FIXTURES`, only if the family seeds anything |

Name every export after the family (`serviceDetailViewSchema`, not `detailViewSchema`):
`export *` fails on two exports with the same name.

### Foundation files (do not edit)

- `packages/shared/src/` except `pages/<family>.ts`: `site-chrome.ts`, `site-paths.ts`,
  `site.ts`, `pages/common.ts`, `home-page.ts`, `landing-page.ts`, `lead.ts`, `media.ts`,
  `seo.ts`.
- `apps/api/src/` except `<family>/`: `site/`, `common/` (`ViewCache`, `publishedAsOf`),
  `home/`, `landing-pages/`, `leads/`, `settings/`, `prisma/`, `settings-cli.ts`.
- `apps/web/app/layout.tsx`, `app/globals.css`, `app/robots.ts`, `app/sitemap.ts`,
  `app/opengraph-image.tsx`, `app/(marketing)/page.tsx`, `app/(marketing)/lp/`,
  `app/(marketing)/(site)/layout.tsx` and `app/(marketing)/(site)/sitemap/`.
- `apps/web/components/site/`, `ui/`, `seo/`, `motion/`, `forms/`, `home/`, `landing/`.
- `apps/web/lib/` except `api/<family>.ts`: `api/index.ts`, `api/core.ts`, `api/site.ts`,
  `seo/`, `sitemap.ts`, `sitemap-core.ts`, `text.ts`, the lead form modules.
- `apps/web/static-content/home.json`, `landing-b2b-website-design.json`,
  `site-chrome.json`, `copy-rules.ts` and the tests beside them.
- `apps/web/e2e/home.spec.ts`, `anchors.spec.ts`, `landing.spec.ts`, `site.spec.ts`.
- `apps/web/next.config.ts`. `images.unsplash.com` and `images.pexels.com` are already allowed.
- `packages/db/` except `src/seed/pages/<family>.ts`: the schema, migrations and seeds.
- `packages/config/`, `packages/perf/`, `infra/`, `docs/`, `CLAUDE.md`, `session.md`.

## What the site layout gives every page

`app/(marketing)/(site)/layout.tsx` renders `SiteShell` around the page:

1. Skip link to `#main`, utility bar, sticky header with mega menus and the mobile menu.
2. `<main id="main">` with the page.
3. The closing conversion band (a labelled region after `main`).
4. Footer, floating "Start a project", the Organization node, `AnchorScroll` and
   `RevealObserver`.

A page renders only its content. Never render a header, footer, skip link, `AnchorScroll`
or `RevealObserver` again, and never add a second Organization node.

- The layout is `force-dynamic`: every site page renders per request and reads
  `site.indexing` then (decision 36). Do not add `generateStaticParams`, `revalidate` or
  `dynamic` to a page.
- The contact page and thank-you pages are themselves the conversion point. Render
  `<PageHasOwnForm />` (`components/site/conversion-band.tsx`) anywhere in them; CSS hides
  the closing band and the floating call to action.
- Unknown slugs: the page calls `notFound()`. `(site)/not-found.tsx` renders inside the site
  layout for those; `app/not-found.tsx` handles URLs that match no route and renders
  `SiteShell` itself with `getSiteChrome()`. `error.tsx` is a client component that ships
  to every route in the group, so keep it to a few lines of markup.
- The chrome comes from `GET /site/chrome` (decision 34). Its links are site paths, never
  bare anchors (decision 35).

## How a page gets its data

The pattern follows `apps/api/src/home` and `apps/api/src/landing-pages`.

### 1. Contract: `packages/shared/src/pages/<family>.ts`

Build view schemas from `pages/common.ts` and the existing shared schemas:

| Building block | Use |
|---|---|
| `answerBlockSchema` | the two or three sentence answer block; `countSentences` explains what counts |
| `questionSchema(max)` | H2 and H3 on content pages, FAQ questions |
| `pageSeoSchema` | `{ title <= 60, description <= 155, ogImage }`; the title without the brand |
| `faqItemSchema` | `{ id, question, answer }` |
| `metricSchema`, `caseStudyCardSchema` | result figures; case study cards (the landing page's `caseResultSchema`) |
| `timedStepSchema` | process steps with durations |
| `testimonialViewSchema`, `imageSchema`, `decorativeImageSchema`, `linkSchema`, `slugSchema` | as elsewhere |
| `SITE_ROUTES`, `servicePath`, `industryPath`, `caseStudyPath`, `locationPath`, `thankYouPath`, `workFilterPath` | every internal URL |

The view is exactly what the API returns and what the snapshot holds.

### 2. API: `apps/api/src/<family>/`

- `<family>.controller.ts`: `@Controller('pages/<route>')`, GET only, `@SkipThrottle()`
  (every render comes from the web server's one address). Slugs go through
  `new ZodValidationPipe(slugSchema)`; a missing record is `NotFoundException`. Export the
  module from this file, as `home-page.controller.ts` does.
- `<family>.service.ts`: Prisma queries and a `ViewCache` (`common/view-cache.ts`) with a
  30 second TTL, keyed by slug for detail views. When the mapper throws, log which record
  or setting failed and throw `InternalServerErrorException`.
- Published means (`common/published.ts`):
  - `publishedAsOf(now)` for models with `publishedAt` (Service, Post, LandingPage);
  - `status: 'PUBLISHED'` for the rest (Industry, Project, Location);
  - `deletedAt: null` wherever the model has it (Service, Project, LandingPage);
  - testimonials only with `consentAt: { not: null }` (`CONSENTED`), on every page,
    including through relations.
- `<family>.mapper.ts`: a pure function from records to the view that ends in
  `<view>Schema.parse(...)`, unit tested in `<family>.mapper.test.ts` (contract failure,
  empty lists, unconsented testimonials left out, figures missing).
- Where the copy lives:
  - Service, Industry and Location have a nullable `content` JSON column for page copy
    beyond their columns, validated by the family schema. Null leaves those sections out.
  - A page without a record (about, pricing, process, contact, FAQ intro, legal pages)
    keeps its copy in a `Setting` row keyed `<family>.<page>` (for example
    `company.about`), with the key constant and schema in the family's shared file.
  - Proof always comes from its content type (Project, Testimonial, TeamMember, Award,
    Partner, Technology, ReviewSource, PricingTier, ProcessStep, Faq), never from copy.
- Placeholder database: the launch seed is placeholder-only (decision 28). Pages that
  need a row to render at all (a page whose copy is a setting) add a placeholder seed in
  `packages/db/src/seed/pages/<family>.ts`, registered in `PAGE_SEEDS`. `content.test.ts`
  scans every registered seed's `content` for invented proof, so write it like
  `src/seed/content.ts`: "Placeholder" copy, no figures, names, ratings or promises.
  Proof-shaped rows for end-to-end tests go in `PAGE_FIXTURES`, which runs in development only.

### 3. Web getter: `apps/web/lib/api/<family>.ts`

```ts
import 'server-only';
import { serviceDetailViewSchema, servicePath, servicesIndexViewSchema } from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import { serviceSnapshots, servicesIndexSnapshot } from '@/static-content/services';
import { findView, getView } from './core';

export const getServicesIndex = cache(() =>
  getView('/pages/services', servicesIndexViewSchema, servicesIndexSnapshot),
);

export const getServicePage = cache((slug: string) =>
  findView(`/pages/services/${encodeURIComponent(slug)}`, serviceDetailViewSchema, serviceSnapshots[slug]),
);

export async function sitemapEntries(): Promise<SitemapEntry[]> {
  const index = await getServicesIndex();
  return [
    { path: '/services/', title: 'Services', section: 'Services' },
    ...index.services.map((service) => ({ path: servicePath(service.slug), title: service.title, section: 'Services' })),
  ];
}
```

- `getView(path, schema, snapshot)`: a view the page cannot render without. `findView`:
  a record's view, or null for a 404, a 400 or a missing snapshot. Both fetch with
  `cache: 'no-store'` and validate with the schema.
- With `API_INTERNAL_URL` unset (the Vercel demo) both return the snapshot, validated.
- Wrap getters in React's `cache`, so the page and `generateMetadata` share one call.
- Sitemap sections are `SITEMAP_SECTIONS` in `lib/sitemap.ts`: Overview, Services,
  Industries, Work, Company, Locations, Plan a project, Legal.

### 4. Snapshots: `apps/web/static-content/<family>/`

- One JSON file per view, exactly the API's response: `index.json`, `<slug>.json`.
- `index.ts` imports them statically and exports the index view and a record keyed by
  slug. Dynamic imports by template string are not used.
- `<family>.test.ts` beside them parses every snapshot with its schema, checks each file
  name matches its slug, and asserts `unfinishedCopy(view)` (`static-content/copy-rules.ts`)
  is empty.
- The snapshots carry the publish-ready copy (see Content). The database seed does not.

### 5. Route

```tsx
// app/(marketing)/(site)/services/[slug]/page.tsx
export async function generateMetadata({ params }: PageProps<'/services/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const page = await getServicePage(slug);
  if (!page) return { robots: { index: false, follow: false } };
  return sitePageMetadata({ ...page.seo, path: servicePath(page.slug) });
}

export default async function ServicePage({ params }: PageProps<'/services/[slug]'>) {
  const { slug } = await params;
  const page = await getServicePage(slug);
  if (!page) notFound();
  return (
    <>
      <PageHero
        crumbs={[{ name: 'Services', path: SITE_ROUTES.services }, { name: page.title, path: servicePath(page.slug) }]}
        title={page.title}
        answer={page.answerBlock}
        intro={page.hero.intro}
      />
      {/* sections */}
      <JsonLd data={serviceJsonLd({ name: page.title, description: page.seo.description, path: servicePath(page.slug) })} />
    </>
  );
}
```

## SEO rules

- One H1, from `PageHero`. The answer block sits straight under it on service, industry
  and location pages, before any promotional line or call to action.
- H2 and H3 on content pages are questions buyers type (`questionSchema`). Legal pages and
  utility pages may use plain headings.
- Metadata only through `sitePageMetadata` (`lib/seo/page-metadata.ts`):
  - title and description from `pageSeoSchema`, unique per page; " | Calwebtech" is added
    when it fits in 60 characters;
  - canonical is absolute on `APP_ORIGIN`;
  - Open Graph and Twitter cards use the page image or the generated default
    (`app/opengraph-image.tsx`);
  - noindex while `site.indexing` is off. Pass `noindex: true` for thank-you pages.
- Filtered listings: a deliberate target combination canonicalises to itself; anything
  else passes `canonicalPath` of the unfiltered parent and `noindex: true`.
- Structured data (docs/04-seo-keyword-map.md) with `JsonLd` (`components/seo/json-ld.tsx`),
  which escapes record text:

  | Template | Nodes | Helpers |
  |---|---|---|
  | Every site page | Organization (the layout), BreadcrumbList (`Breadcrumbs`) | already rendered |
  | Service | Service with Offer, FAQPage | `serviceJsonLd`, `FaqSection` |
  | Industry | Service, FAQPage | `serviceJsonLd` with `serviceType`, `FaqSection` |
  | Case study | Article, Review | the work family's own, in `components/work/` |
  | Location | ProfessionalService with areaServed, FAQPage | the locations family's own, `FaqSection` |
  | Testimonials | Review, AggregateRating, only for reviews that exist | the company family's own |

  Family builders return `JsonLdObject` and refer to the company as
  `{ '@id': organizationId() }`. One FAQPage node per page: `FaqSection jsonLd={false}`
  for any second list.
- URLs are lowercase, hyphenated, with a trailing slash. Build them with the path helpers.
- Register the family's pages in `lib/sitemap-sources.ts`, so they reach `sitemap.xml` and `/sitemap/`.

## Shared components

Server components in `apps/web/components/site/`. They follow the homepage's visual language.

| Component | File | Use |
|---|---|---|
| `PageHero` | `page-hero.tsx` | breadcrumbs, H1, answer block, intro, calls to action, optional aside; `ground="dark"` (ink, optional backdrop preloaded as LCP) or `"light"` (tinted, for utility and legal pages) |
| `Breadcrumbs` | `breadcrumbs.tsx` | inside `PageHero`; on its own only if a page has no hero |
| `AnswerBlock` | `answer-block.tsx` | inside `PageHero` via `answer` |
| `Section` | `section.tsx` | full-bleed section, tones `white`, `tint`, `mist`, `ink`, `band`; alternate them and never repeat a tone next to itself; `deferred={false}` above the fold |
| `SectionHeading` | `section-heading.tsx` | H2 or H3, intro, "see all" link |
| `FaqSection` | `faq-section.tsx` | FAQ accordion (`landing/faq-accordion.tsx`) with its FAQPage node |
| `CardGrid`, `LinkCard`, `CaseStudyCard`, `TestimonialCard` | `cards.tsx` | card grids; a link card is one target named by its title |
| `MetricBand`, `CtaBand` | `bands.tsx` | result figures, a mid-page call to action |
| `EmptyState`, `CheckList`, `StepList`, `Prose` | `lists.tsx` | empty states, deliverables with check marks, timed steps, long-form legal copy |
| `ConversionBand`, `PageHasOwnForm` | `conversion-band.tsx` | the band is the layout's; pages use only `PageHasOwnForm` |
| `LeadForm` | `components/forms/lead-form.tsx` | every form that stores a lead; posts through the existing server action |

## Links the chrome already makes

The chrome and the demo homepage copy link to these, so the families build them under
exactly these slugs.

Services (`/services/<slug>/`), with what each page must also cover because a menu label
points at it:

| Slug | Title | Also covers |
|---|---|---|
| `custom-website-development` | Custom website development | UI/UX and design systems, branding applied to the site |
| `website-redesign` | Website redesign | conversion optimisation, performance engineering, project rescue |
| `web-application-development` | Web application development | React Native companion apps |
| `ecommerce-development` | Ecommerce development | |
| `nextjs-development` | Next.js development | headless CMS builds |
| `wordpress-development` | WordPress development | WooCommerce |
| `shopify-development` | Shopify development | |
| `ai-search-visibility` | AI search visibility | technical SEO, the AI visibility check |
| `ai-integration` | AI integration | |
| `care-plans` | Website care plans | |

Industries (`/industries/<slug>/`): `manufacturing`, `distribution`, `ecommerce-and-d2c`,
`saas`, `healthcare`, `real-estate`, `hospitality`, `professional-services`. Construction,
financial services and education appear in menus and link to `/industries/`.

Work: case studies `northmark-supply`, `verona-home`, `truvia-labs`, `cascadia-health`,
`meridian-parts`; filters `?industry=`, `?service=` and `?platform=` with slug values
(`workFilterPath`), for example `/work/?service=ecommerce-development`.

Also linked: `/before-and-after/`, `/testimonials/`, `/awards/`, `/about/`, `/team/`,
`/technology/`, `/pricing/`, `/process/`, `/locations/`, `/contact/` (with "Free website
audit" among its enquiry types, which the menus link to), the five legal pages, `/sitemap/`,
and two homepage sections, `/#estimate` and `/#insights`.

Planned routes outside this batch that the approved menus still link to, and which return
404 until they exist: `/guides/`, `/glossary/`, `/careers/`, `/demos/`.

To change the chrome's demo links, change `static-content/home.json` and regenerate
`site-chrome.json` with `node apps/web/scripts/site-chrome-snapshot.mjs`.

## Content (owner's decision, 2026-09-14)

This replaces any older content rule.

- Every page ships complete, relevant, publish-ready copy: no "Placeholder", "lorem",
  "TBD", "coming soon", "to confirm", empty headings or dummy bullets. Write original copy;
  never copy text from other websites.
- Match the approved homepage and landing page: plain, specific, confident, no hype, British
  spelling (optimisation, catalogue, recognised).
- Write the full substance a page needs: answer blocks, hero lines, problem framing,
  deliverables, process, comparisons, what moves the price, industry pain points and
  integrations, local context per city, about and values copy, FAQs, thank-you copy, and
  complete legal pages that describe how this platform handles data:
  - leads, bookings and subscribers are stored in our own PostgreSQL;
  - Cloudflare Turnstile checks forms;
  - Resend is only the sending transport;
  - the cookies actually set (none for analytics until consent exists);
  - backups as planned in docs/01: nightly encrypted dumps off-site, retained 7 daily,
    4 weekly and 6 monthly, RPO 24 hours, RTO 4 hours.
- Imagery and video: Unsplash (`images.unsplash.com`) and Pexels (`images.pexels.com`,
  `videos.pexels.com`) only. Check every URL returns HTTP 200 with curl before using it;
  write descriptive alt text; background video uses `BackgroundVideo` with a poster.
- Proof reuses the approved demo proof only, consistently across pages:
  `static-content/home.json`, `static-content/landing-b2b-website-design.json` and
  `reference/*.html`. That is the case studies and their figures, client names,
  testimonials and who gave them, the ratings and review counts, the team, awards,
  partners, press names, statistics, pricing tiers, process steps and guarantees. You may
  write a fuller narrative for an existing case study (challenge, approach, build,
  outcome) consistent with its summary, but add no new figures to it, and create no new
  client, person, award, certification, partnership, rating or guarantee.
- All of it goes into the snapshots. The database seed stays placeholder-only.

### Known conflicts in the approved demo proof

Raise these with the owner; until then keep both identities off the same page.

- "Priya Raman" is Calwebtech's Design Lead (landing team) and Truvia Labs' VP Marketing
  (testimonial). "Dana Whitfield" is Calwebtech's Delivery Manager (landing team) and
  Halloway Group's Operations Lead (video testimonial).
- The same portrait photographs are reused: Dale Ferris's avatar is Rasel Mridha's team
  photo, Marcus Bell's is Sawkat Hasan's, and Priya Raman's is the same in both roles.

## Performance and accessibility

- Server components by default; `'use client'` only for small leaf components. Own client
  JS per route stays under 20 kB gzip (`pnpm --filter @calwebtech/web budget`); a content
  page should add none beyond the layout's (about 2 kB).
- No `next/link`, no `next/image` (docs/09). Use `<a>`, `ResponsiveImage` and `BackdropImage`.
- Tailwind token classes only; lint rejects raw hex. Teal (`text-result`, `bg-result`) only
  on outcome figures (bold display type) and check marks or status dots on a round
  element, never on headings, buttons, links, borders or card backgrounds.
- `content-auto` below the fold (`Section` does it), never on the section with the LCP element.
- WCAG 2.2 AA: one H1, headings in order, landmarks, labelled inputs with described errors,
  visible focus, 24px targets, keyboard operable. Motion is opacity and transform only, and
  respects reduced motion (`reveal()` does).
- Every index page renders an `EmptyState` when nothing is published, and every unknown
  slug returns 404, against the placeholder database CI uses.

## Before committing

```
pnpm --filter @calwebtech/shared build
pnpm --filter @calwebtech/db exec vitest run
pnpm --filter @calwebtech/api typecheck && pnpm --filter @calwebtech/api lint && pnpm --filter @calwebtech/api test
pnpm --filter @calwebtech/web typecheck
cd apps/web && node_modules/.bin/eslint app components lib e2e
pnpm --filter @calwebtech/web test
pnpm --filter @calwebtech/web budget
```

End-to-end, against the placeholder database with fixtures (ports 3000, 4000 and 3443):

```
pnpm --filter @calwebtech/api build && pnpm --filter @calwebtech/web build
APP_ENV=development pnpm db:seed && APP_ENV=development pnpm db:seed:fixtures
pnpm --filter @calwebtech/web exec playwright test e2e/<family>.spec.ts
```

A family's spec covers, at 360px and 1440px: one H1, noindex while `site.indexing` is off,
the answer block before any call to action where the template has one, breadcrumbs, no
horizontal overflow, keyboard use of anything interactive, the empty state of each index,
and a 404 for an unknown slug.

## For the integrator

- Merge the registration lines, then run every check above and all end-to-end specs.
- Add one page per new template to `PAGES` in `packages/perf/src/serve.mjs` so the
  Lighthouse gate measures it.
- Check that every link in `site-chrome.json` resolves to a built page, apart from the
  planned routes listed above.
