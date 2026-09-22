# 05. Design System

The brand book at `calwebtech-design-system/README.md` (outside the repo) is the source of
truth for appearance. This file records how it is implemented here, and the boundaries are
in `RULES.md`.

The mockups in `reference/` record the white-and-cobalt design this replaced. They are
history, not the target (`docs/08-decisions.md`, 46).

## Tokens

Defined in `packages/config/tailwind/theme.css` as Tailwind v4 `@theme` entries and imported
by `apps/web/app/globals.css`. Use the names, never a raw hex value; lint rejects one.

### Ground and ink

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F4EFE6` | the ground of every light section |
| `canvas-raised` | `#FAF7F0` | a panel or a band that lifts off the ground |
| `canvas-sunken` | `#ECE4D6` | what separates two light sections; the logo rail |
| `canvas-invert` / `navy-900` | `#0A1628` | the dark band, the footer, the shadow half of a duotone |
| `navy-700` | `#13263F` | hover for navy surfaces |
| `navy-500` | `#1F4067` | decorative only; it does not carry text |
| `ink` | `#101A24` | page copy on any light ground |
| `ink-muted` | `#5C5648` | secondary copy on light |
| `ink-invert` | `#F6F2EA` | copy on navy or over a plate |
| `ink-invert-muted` | `#BDB6A5` | secondary copy on dark |

### Champagne

Two forms, not interchangeable. `gold-500` is 1.8:1 on cream and disappears there.

| Token | Value | Use |
|---|---|---|
| `gold-500` | `#CFAE72` | dark grounds only: eyebrows, numerals, links, rules, the one gold button |
| `gold-300` | `#E6D3AA` | hover for a gold fill |
| `gold-ink` | `#6F5320` | the same hue at text weight, for light grounds |
| `gold-600` | `#A5813F` | the logo's fill on light grounds — artwork, not text |
| `on-gold` | `#16120A` | a label on a gold fill |

Gold may carry an eyebrow, a numeral, a link or a rule. Never a heading, never a price,
never a fill behind text, never more than three elements in one viewport. The rule is
asserted in `apps/web/components/services/sections.test.tsx`.

### Rules, scrims and shadows

| Token | Use |
|---|---|
| `hairline` | the 1px default separator |
| `hairline-strong` | its hover, and a ghost button's border |
| `hairline-gold` | once per section, above the eyebrow |
| `scrim` / `scrim-strong` | over a photograph; the strong one wherever text sits on it |
| `shadow-lift` | the sticky nav, and nothing else |
| `shadow-plate` | a plate that overlaps the section beneath it |

### Still on the old palette

`primary`, `mist`, `mist2`, `line`, `body`, the glows and the gradient utilities belong to
the design this replaced and leave as each family is redressed. `result` and `danger` stay
for good: the dashboard resolves them inside `[data-theme='admin']`, where they are readable
on deep navy, and the `calwebtech/teal-usage` lint rule guards them there.

## Typography

Display: **Archivo**, 700–800, negative tracking. Body: **Manrope**, 400–700. `meta`
numerals: **IBM Plex Mono**, 500. All three are self-hosted through `next/font`, so no
request leaves for Google at render time and the metrics are known before first paint — CLS
stays at 0.

The dashboard keeps Plus Jakarta Sans and IBM Plex Sans, resolved inside
`[data-theme='admin']`: Archivo's tracking is drawn for a 112px headline, not a 13px table
row.

One utility per style, each stepping down at 900px and 600px:

`display-mega` · `display-xl` · `display-lg` · `display-md` · `display-quote` ·
`heading-lg` · `heading-md` · `heading-sm` · `body-lg` · `body-base` · `body-sm` ·
`eyebrow` · `nav-label` · `button-label` · `meta`

One display size per section. **`display-mega` is for a cream hero only**; over a
photograph `display-xl` is the ceiling. `eyebrow`, `nav-label` and `button-label` are the
only styles that take positive tracking and uppercase.

## Layout

Content width **1320px** through the `shell` utility: 24px gutters, 64px from 900px. A
12-column grid. Sections are full-bleed; content is contained. Text blocks sit in columns
1–7 or 6–12, never centred except in the closing call to action.

Section padding starts at 128px on desktop (`py-32`), 96px on phones.

## Section rhythm

Never two adjacent sections with the same treatment. Each is cream, invert or plate, and
two light sections in a row need `canvas-sunken` between them rather than a border.

A plate carries `scrim-strong` across the whole image wherever text sits on it — not a
gradient at the lower edge, which leaves a headline's first line on raw photography.

## The header

The bar is **fixed**, not sticky. A page whose first section is a dark hero runs its plate
under the bar, and the bar is transparent there; a page that opens on anything else reserves
the bar's height (`--site-header-height`). Past 120px of scroll the bar takes the cream
ground and its rule back.

The hero declares its ground with `data-hero="dark"` or `"light"`, and one `:has()` rule in
`globals.css` reads it — so a page that opens on cream never gets a transparent bar with
inverted type on it. `HeaderScrollState` marks the document; the header stays a server
component and nothing re-renders on scroll.

A mega menu heading is a link where the family has an index page, with the chevron beside it
as the panel's control. The keyboard contract is in `RULES.md`, section 7.

## Component inventory

Sticky header with mega menus. Hero: a plate under one scrim with the type over it, and the
quote form beside it. Proof band of figures in champagne, opened by a slab rule. Logo rail.
Problem router accordion. Numbered editorial service index. Filterable case study cards,
each one a single link. Video modal. Pull quote at display weight 500 on raised cream.
Mid-page CTA band. Before and after drag slider. Industry card grid. Multi-step form shell
with progress. Cost calculator step card. Differentiator list. Technology category card.
Process timeline. Testimonial card and video testimonial. Tabbed recognition panel.
Whitepaper capture band. Location card. Engagement band. FAQ accordion. Conversion band.
Footer.

The utility bar above the header was removed on 2026-09-22 at the owner's request.

## Photography

The site's photographs are content and come from the snapshots or the database. The five
plates the design system ships are **generated placeholders, not licensed photography** —
they fix the grade and the crop, and its own `assets/plates/README.md` briefs the real shot
for each. They are not used on the site.

Band and backdrop images are requested at reduced quality: under a 72% scrim, the detail a
higher setting buys is detail nobody can see.

## Background video

Poster image in the base layer with a slow Ken Burns transform. The video layer
(`components/ui/background-video.tsx`) sits above at `opacity: 0` and fades in only on
`canplay`, so a missing or slow file never shows a black frame. Overlays sit above the
video, which pauses when scrolled out of view.

The video never loads under `prefers-reduced-motion`, with Data Saver on, or below 768px:
phones keep the poster, which is also the LCP image, and download nothing more. Once a video
plays a pause button appears (WCAG 2.2.2), so the video component sits outside the section's
`aria-hidden` backdrop wrapper. Use the video's first frame as the poster.

Assets expected at `public/assets/calwebtech-showreel.mp4` and
`public/assets/calwebtech-showcase-bg.mp4`. Eight to twelve second muted loops, under 20MB.

## Motion

Slow, single-axis, once only, on `--ease-out-quint`.

- **Reveal:** headings and rows fade in and rise 24px, staggered 80ms, once.
- **Plate:** a hero plate scales 1.06 → 1.00. Nothing else scales.
- **Link:** an underline grows from the left; an arrow travels 6px.
- **Marquee:** the logo rail takes 42 seconds per pass, linear, and pauses on hover.

Nothing bounces, nothing springs, nothing loops except the marquee. Every animation is
disabled under `prefers-reduced-motion`, and in-page links are smoothed by `AnchorScroll`,
never by CSS `scroll-behavior` (`docs/09-performance.md`).

## Accessibility

Contrast verified at token level — Lighthouse reports `color-contrast` passing with zero
failing elements on the redesigned homepage. Visible focus: a 2px ring at 2px offset, using
`focus` on light grounds and `focus-invert` on dark.

Full keyboard operability including the mega menus, the modal (focus trapped, Escape closes,
focus returns to the trigger) and the before and after slider (range input fallback).
Semantic landmarks, correct heading order, labelled inputs with described errors, alt text on
every meaningful image and `aria-hidden` on decorative ones.
