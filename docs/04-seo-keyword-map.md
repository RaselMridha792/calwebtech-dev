# 04. SEO and Keyword Map

Volume figures are informed estimates, not tool readings. Verify each cluster once in
Ahrefs or Semrush before writing copy. Clustering and page mapping will not change.

## Search context, 2026

AI answer engines resolve a growing share of informational queries, and Google places
AI Overviews above traditional results for many commercial ones. The competitive unit
for those queries is a citation inside a generated answer. Content must therefore be
written to be extracted: answer first, question-shaped headings, specific figures,
visible author and update date, clean structured data. Promotional phrasing measurably
reduces citation rates.

Most AI systems retrieve candidates from a conventional index first, so correct SEO is
the prerequisite, not the alternative. Bing indexing is verified separately at launch
because a large share of assistant retrieval runs through it.

## Clusters mapped to URLs

| Cluster | Example queries | Target |
|---|---|---|
| A. Core commercial | web design agency, web development company, custom website development company | `/`, `/services/`, `/services/custom-website-development/` |
| B. Platform | next js development agency, wordpress development company, shopify development agency | `/services/<platform>-development/` |
| C. Audience and niche | b2b web design agency, saas website design agency, manufacturing website design | `/industries/<slug>/` |
| D. Location | web design agency sacramento, web development company san francisco, near me | `/locations/<city>/`, `/<service>/<city>/` |
| E. AI search | generative engine optimization services, ai seo services, how to get cited by chatgpt | `/services/ai-search-visibility/` plus articles |
| F. Cost | how much does a website cost, website design cost, ecommerce website cost | pillar article plus `/cost-calculator/` |
| G. Problem-aware | why is my website not generating leads, website redesign checklist | articles routing to `/free-website-audit/` |
| H. Comparison | wordpress vs next js, shopify vs woocommerce, headless cms vs traditional | comparison articles |
| I. Tools | website cost calculator, free website audit | `/cost-calculator/`, `/free-website-audit/` |
| J. Definitions | what is a headless cms, what is core web vitals | `/glossary/<term>/` |

No two pages target the same primary query. If a new page would compete with an
existing one, extend the existing page instead.

## Location rules

- One location per page. Never two cities on one page.
- Hard ceiling of twenty city pages. Beyond that the set reads as a doorway farm.
- Minimum sixty per cent unique body content per city: local clients, local industries,
  local context. Cloned copy with a swapped city name will not rank.
- Publish only where there is something real to say.
- URL pattern `/locations/<city>/` and `/<service>/<city>/`.

Tier 1: Sacramento, Roseville, Folsom, Elk Grove, Davis.
Tier 2: San Francisco, San Jose, Los Angeles, San Diego, Irvine, Oakland.
Tier 3: Austin, Seattle, Denver, Phoenix, Dallas, published only once a client in that
market can be named.

Matrix pages at launch: ecommerce-development and wordpress-development and
b2b-web-design, crossed with Sacramento, San Francisco, Los Angeles and San Diego as
listed in `docs/03-page-specs.md`.

## Technical requirements

- One H1 per page. Titles under 60 chars, descriptions under 155, unique everywhere.
- Canonical on every page. Filtered views canonicalise to the unfiltered parent unless
  the combination is a deliberate target.
- XML sitemap split by content type, regenerated on publish, submitted to Google
  Search Console and Bing Webmaster Tools.
- `robots.txt` permits major AI crawlers. This is a deliberate business decision.
- `llms.txt` published, describing the company, services, service area and key pages.
- Automatic permanent redirect map on slug change.
- Core Web Vitals as CI release gates.

## Internal linking

Services link down to industries, case studies and glossary terms. Case studies link
up to every service used and their industry. Articles link to one service and one case
study each, chosen by topic. Glossary terms link to the delivering service. Location
pages link to at most six adjacent locations. No orphans: every URL is reachable from
at least two other pages plus the footer or sitemap.

## Schema per template

| Template | Structured data |
|---|---|
| Global | Organization with sameAs, WebSite with SearchAction |
| Homepage | Organization, AggregateRating, ItemList |
| Service | Service, Offer with priceRange, FAQPage, BreadcrumbList |
| Industry | Service, FAQPage, BreadcrumbList |
| Case study | Article, Review, BreadcrumbList |
| Location | LocalBusiness or ProfessionalService with areaServed, FAQPage |
| Article | Article with author, datePublished, dateModified, FAQPage where applicable |
| Glossary | DefinedTerm within DefinedTermSet |
| Testimonials | Review, AggregateRating, only where the reviews genuinely exist |
| Careers | JobPosting with validThrough and salary band |
