# 00. Project Brief

## The business

Calwebtech is a web design and development agency selling a high-trust,
high-consideration service. A buyer typically evaluates the work over several
sessions before making contact. The website is therefore not a brochure: it is the
primary sales asset, the proof-of-capability demo, and the top of the funnel.

## Problems this build solves

- No owned lead database. Enquiries arrive scattered across forms, marketplaces and
  social channels, and cannot be segmented or re-activated.
- Services, portfolio and testimonials cannot be published without a developer.
- No structured booking path, so high-intent visitors drop off at the moment they are
  ready to talk.
- No campaign capability. Offers cannot be sent to past enquiries.
- Platform builders create recurring cost, performance ceilings and no data control.

## Audiences

| Visitor | What they want | Where they land |
|---|---|---|
| The evaluator | Proof of capability | Work, case studies, before and after |
| The buyer | Scope and price | Services, pricing, calculator, booking |
| The researcher | Understanding | Insights, glossary, guides |

Every page routes to one of three endpoints: Book a Consultation, Start a Project,
or Subscribe.

## Success metrics, verified at day 30

| Metric | Target |
|---|---|
| Lighthouse performance, mobile | 90+ |
| Core Web Vitals, field, p75 | LCP under 2.5s, INP under 200ms, CLS under 0.1 |
| Time to publish a service page, non-developer | under 10 minutes, dashboard only |
| Lead capture coverage | 100% of submissions stored with source attribution |
| Booking completion | under 60s from slot selection to confirmation email |
| Campaign send | any saved segment reachable in under 5 minutes |
| Uptime | 99.5% monthly, external monitor |

## Out of scope

Payment processing and checkout, client portal, native mobile apps, ongoing SEO
campaigns, CRM integration, multilingual. Each is designed for but not built. The
architecture must accept them later without rework.
