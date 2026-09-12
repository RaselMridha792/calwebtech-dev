# 03. Page Specifications

61 URLs. Templated pages show the record count expected at launch. Every URL is
lowercase, hyphenated, trailing slash.

## Sitemap

| URL | Type | Tier | Launch records |
|---|---|---|---|
| `/` | static + dynamic | 1 | built, approved |
| `/about/` | static + dynamic | 1 | |
| `/services/` | dynamic index | 1 | |
| `/services/<slug>/` | template | 1 | 10 |
| `/industries/` `/industries/<slug>/` | index + template | 1 | 8 |
| `/work/` `/work/<slug>/` | index + template | 1 | 8 to 12 |
| `/before-and-after/` | index | 2 | 4 to 6 |
| `/demos/` | index | 3 | may launch hidden |
| `/locations/` `/locations/<city>/` | index + template | 1 | 11, ceiling 20 |
| `/<service>/<city>/` | matrix template | 2 | 9 |
| `/technology/` | index | 2 | |
| `/process/` | static | 1 | |
| `/pricing/` | static + dynamic | 1 | |
| `/cost-calculator/` | application | 1 | |
| `/free-website-audit/` | static + form | 1 | |
| `/insights/` `/insights/<category>/` `/insights/<slug>/` | index + template | 1 | 6 to 8 |
| `/guides/` `/guides/<slug>/` | index + template | 2 | 2 to 3 |
| `/glossary/` `/glossary/<term>/` | index + template | 2 | 30 to 40 |
| `/testimonials/` `/awards/` `/partners/` `/team/` | index | 2 | |
| `/careers/` `/careers/<slug>/` | index + template | 3 | |
| `/faq/` | index | 2 | |
| `/contact/` `/book-a-consultation/` `/start-a-project/` | application | 1 | |
| `/lp/<campaign>/` | landing template | 1 | noindex by default |
| `/thank-you/<type>/` | static | 1 | one per conversion type |
| `/privacy-policy/` `/terms/` `/cookie-policy/` `/accessibility/` `/information-security/` | legal | 1 | |
| `/sitemap/` `/search/` `/404/` `/500/` | system | 1 | designed, not default |

## Global components

Utility bar (phone, email, service area, aggregated review badge with expandable
source breakdown, client login, support). Sticky header with mega menus for Services,
Industries, Work and Resources, each panel carrying an explanatory line per column
plus a featured case study or resource. Dashboard-editable announcement bar.
Breadcrumbs everywhere except home and landing pages. Persistent floating
"Start a project". Conversion band closing every page. Newsletter capture. Granular
cookie consent blocking analytics until given. Full footer.

## Homepage `/`

Built and approved. Sections in order: utility bar, sticky header, hero with
background video and embedded quote form and award badges, stats strip, client logo
band, video-backed capability band with showreel modal, problem router accordion,
services grid, featured work with filter tabs and metric cards and embedded client
quote and 30-second story modal, pull quote, mid-page CTA band, before and after
slider, industries grid, cost calculator band, why us, technology proof, process
timeline, testimonials with video and press band, tabbed awards and press and
expertise, whitepaper capture, locations, insights, pricing bands, conversion form,
footer.

Match `reference/homepage.html` exactly.

## Service detail `/services/<slug>/`

Primary action: get a quote. Schema: Service, Offer, FAQPage, BreadcrumbList.

1. Answer block, two to three sentences, before anything promotional
2. Hero: service name, outcome sub-headline, dual CTA, starting price band
3. Problem framing: the three situations that bring a buyer here
4. What is included: itemised deliverables
5. How it works: process steps with durations
6. Technology band, pulled from the Technology type
7. Proof: two or three related case studies with metrics
8. Comparison: our approach versus freelancer, page builder, offshore body shop
9. Pricing indication and what moves the number
10. Related industries
11. Service-specific testimonial
12. FAQ, six to eight, question-shaped headings
13. Inline enquiry form pre-filled with service context
14. Related services, conversion band

Launch records: custom website development, website redesign, web application
development, ecommerce development, Next.js development, WordPress development,
Shopify development, AI search visibility, AI integration, care plans.

## Industry detail `/industries/<slug>/`

Answer block; hero; four sector-specific pain points in industry vocabulary; matched
services translated for the vertical; compliance or integration notes; filtered case
studies; sector metrics band; sector testimonial; common integrations; five to six
FAQs; conversion band.

Launch records: manufacturing, distribution, ecommerce and D2C, SaaS, healthcare,
real estate, hospitality, professional services.

## Work index `/work/` and case study `/work/<slug>/`

Index: results summary stated numerically; faceted filters for industry, service and
platform with the filter state written into the URL; cards carrying cover image,
client, location and segment tags, three metrics and a one-line summary; pagination
past twelve; aggregate proof band.

Detail: answer block; hero with headline outcome; metric band of three to six results
prominently sized; at a glance strip (industry, services, platform, duration, year,
live URL); challenge; approach; build detail; interface gallery; before and after
where applicable; outcome with measurement method; client quote with photo; optional
video testimonial; related services and case studies; conversion band.

## Location `/locations/<city>/`

Answer block; hero with service area statement and local contact; local industry
context; clients served here; services framed for this market; filtered local case
studies; how we work with clients here (meeting model, timezone, response); map or
service area with address where one exists; local testimonial; at most six nearby
area links; four to five genuinely local FAQs; conversion band with local number.

At least sixty per cent unique body content. If that cannot be written honestly, do
not publish the page.

## Cost calculator `/cost-calculator/`

Hero stating what the tool does and the honest range. Eight steps: project type,
timeline, page count, design depth, content and copywriting, integrations, CMS choice,
ongoing support. Progress bar with remaining time. Email gate at the result step.
Result showing the range, the breakdown behind it, and what would move it. Immediate
next action booking a consultation with answers pre-loaded. Emailed copy. Methodology
explanation, which is also the content that ranks. Pricing FAQ.

Every answer is stored as a segmentation field on the lead. That is the real product
of this page.

## Insights, glossary, guides

Article: answer block under the H1; author with photo and credentials, publish and
updated dates, reading time; table of contents past 1,200 words; question-shaped H2
and H3; data tables and specific cited figures; inline subscribe at sixty per cent
scroll; contextual service CTA; key takeaways block; related posts and services;
generated OG image.

Glossary term: one-sentence bold definition immediately under the H1; two to three
paragraphs of expansion; why it matters commercially; a concrete example from real
work; related terms and the delivering service; last-updated date.

Guide: an ungated summary substantial enough to rank on its own, then the email gate
for the full download. Gating the whole thing makes the page invisible.

## Campaign landing `/lp/<campaign>/`

Built and approved. Minimal header with no site navigation, hero with the form above
the fold, trust bar, problem, solution, services, results, process, partners and
technology, team, testimonials, guarantees, pricing anchor, objection FAQ, repeated
form, minimal footer, sticky mobile call and CTA bar. `noindex` by default.

Match `reference/landing-page.html`.

## Utility pages

Thank-you pages per conversion type, confirming what was submitted, the response
window, and a secondary action; conversion events fire here. Designed 404 with search
and the six most popular destinations. Branded 500 and maintenance. Search across
services, work, insights, glossary and FAQ with type filters. Human-readable HTML
sitemap. Legal set with consent gating analytics. Accessibility statement naming the
standard met and how to report a barrier. Information security page describing data,
credential and backup handling.
