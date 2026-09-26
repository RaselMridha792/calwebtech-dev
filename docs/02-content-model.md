# 02. Content Model

Everything repeatable is a database-backed content type with its own admin editor,
listing page, detail template and SEO fields. Adding a record must generate the public
template, listing entry, sitemap entry and social preview automatically.

The authoritative schema is `prisma/schema.prisma`. This file explains intent.

## Content types

| Type | Key fields | Renders on |
|---|---|---|
| Service | title, slug, shortDescription, icon, heroMedia, category, problemStatement, deliverables[], processSteps[], technologies[], startingPriceBand, faqs[], relatedProjects[], SEO, order, status | services index and detail, homepage grid, mega menu, footer, quote form dropdown |
| ServiceCategory | name, slug, description, order | services filters, nav grouping |
| Project | title, slug, clientName, liveUrl, industry, serviceTypes[], technologies[], coverImage, gallery[], challenge, approach, outcomeMetrics[], clientQuote, duration, year, featured, SEO, status | work grid and filters, homepage, service detail, case study template |
| Demo | title, slug, thumbnail, previewUrl, industry, functionalityTags[], stack, description | demo showcase |
| Testimonial | clientName, role, company, avatar, rating, quote, source, videoUrl, linkedProject, featured, date | homepage, testimonials page, case studies, service pages |
| Comparison | clientName, heading, summary, before and after images (alt, width, height), up to four figures, status, position, onHomepage, linkedProject | `/before-and-after/`, homepage (decision 70) |
| Post | title, slug, excerpt, coverImage, author, category, tags[], body (MDX), readingTime, publishedAt, updatedAt, featured, SEO, status | insights index, article template, homepage strip |
| Faq | question, answer, group, order, attachTo (global, service, page) | FAQ page, service accordions, booking page |
| TeamMember | name, role, photo, bio, skills[], socials[], order | about, team, article author block |
| Technology | name, logo, category, proficiencyNote, order | technology page, service detail, case study band |
| Industry | name, slug, heroCopy, painPoints[], matchedServices[], proofProjects[], SEO | industry pages, campaign landing targets |
| Location | city, slug, tier, serviceArea, localIndustries[], localClients[], address, phone, nearbyLocations[], faqs[], SEO | locations index and city pages |
| GlossaryTerm | term, slug, shortDefinition, body, relatedTerms[], relatedService, updatedAt | glossary index and term pages |
| Award | name, category, year, awardingBody, project, description, badge | awards archive, footer, homepage |
| Partner | name, logo, tier, certification, meaningForClient, quote | partners page, homepage band |
| Statistic | label, value, suffix, order | homepage counters, about |
| JobOpening | title, slug, type, location, salaryBand, description, requirements[], status | careers |
| PageSection | sectionKey, heading, subheading, body, media, ctaLabel, ctaUrl, visible | hero, announcement bar, static blocks, editable without deploy |
| MediaAsset | file, altText, dimensions, formatVariants, uploadedBy, usageRefs | every type, managed in the media library |
| Redirect | fromPath, toPath, statusCode, createdAt, reason | automatic on slug change |

## Lead and sales

`Lead` is one table with a `type` discriminator so the dashboard shows one unified
inbox rather than separate silos. Related: `LeadActivity`, `LeadNote`, `LeadAttribution`,
`EnquiryType`, `FileUpload`.

Capture points, all writing to `Lead`:

| Point | Extra fields captured | Routing |
|---|---|---|
| Start a project | projectType, serviceInterest, budgetBand, timeline, description, file | sales, high priority, instant alert |
| Service page enquiry | service context pre-filled | sales, tagged with the service |
| Book a consultation | consultationType, slot, timezone, context | bookings plus sales |
| Contact form | enquiryType | routed mailbox and queue |
| Newsletter | sourcePage | subscribers, welcome sequence |
| Cost calculator | all eight answers stored as segmentation fields | sales plus subscribers |
| Free audit | siteUrl, mainConcern, competitorUrl | sales, high priority |
| Careers | role, portfolioUrl, cv | careers queue, excluded from marketing |

## Rules the system enforces

- Slugs are auto-generated, uniqueness-checked, and never change silently. Editing a
  published slug creates a permanent redirect automatically.
- Every content type carries its own SEO title, description, canonical override and
  OG image, with sensible fallbacks.
- Draft, scheduled and published states, with a live preview URL for drafts.
- Image uploads are validated, converted to modern formats, and stored with generated
  responsive variants. Alt text is required.
- Deleting a referenced record warns first and never leaves a broken public page.
- Leads, subscribers and bookings link to a canonical contact identity, so one person
  is not counted three times.
- Consent and suppression are separate from subscription state. An unsubscribe can
  never be undone by an import.
