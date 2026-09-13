# 05. Design System

The approved mockups in `reference/` are the source of truth for appearance. This file
records the decisions behind them so new pages stay consistent.

## Tokens

| Token | Value | Use |
|---|---|---|
| `ink` | `#0A1D37` | primary text, dark sections, primary buttons on light |
| `ink2` | `#12294A` | hover state for ink surfaces |
| `primary` | `#1550E0` | primary actions, links, focus rings |
| `primaryd` | `#0F3FB4` | primary hover |
| `result` | `#0E9F87` | **outcome figures and affirmative marks only** (check icons, status dots). Never headings, body text, buttons, links, borders or card backgrounds |
| `--glow-teal` | `#0E9F87` | ambient background glow only, through `glow-teal` and `bg-glow-teal-*` |
| `mist` | `#EEF3F9` | tinted section fill, chips |
| `mist2` | `#F7FAFD` | lightest tint |
| `line` | `#DCE4EE` | borders, dividers |
| `body` | `#41536B` | body copy |

## Typography

Display: Plus Jakarta Sans, 700 and 800, tracking `-0.02em`.
Body: IBM Plex Sans, 400 to 600.

Scale: 12, 13, 14, 15, 16, 17, 18, 20, 24, 30, 34, 42, 54, 62. Line length under
80 characters. Sentence case throughout; no all-caps labels.

## Layout

Content width 1440px. Gutters 24px, 56px at `lg`. Grid: 12 column desktop, 8 tablet,
4 mobile. Sections are full-bleed; content is contained.

## Section rhythm

Never two adjacent sections with the same treatment. The approved sequence alternates:

white → tinted gradient with grid texture → white → image with navy overlay →
colour band → white → tinted → image overlay → white

Background images sit at 10 to 30 per cent opacity under a gradient overlay so text
contrast never depends on the photograph.

## Component inventory

Utility bar with review popover. Sticky header with mega menu. Hero with layered
video and poster and embedded form. Stats strip. Logo marquee. Problem router
accordion. Service card. Filterable card grid. Metric-led case study card with tags
and embedded quote. Video modal. Pull-quote band. Mid-page CTA band. Before and after
drag slider. Industry image card. Multi-step form shell with progress. Cost calculator
step card. Differentiator list. Technology category card. Process timeline. Testimonial
card and video testimonial. Tabbed recognition panel. Whitepaper capture band. Location
card. Pricing band card. FAQ accordion. Conversion band. Footer.

## Background video

Poster image sits in the base layer with a slow Ken Burns transform. The video layer
sits above at `opacity: 0` and fades in only on `canplay`, so a missing or slow file
never shows a black frame. Videos pause when scrolled out of view via
IntersectionObserver, and never load at all under `prefers-reduced-motion`.

Assets expected at `public/assets/calwebtech-showreel.mp4` and
`public/assets/calwebtech-showcase-bg.mp4`. Eight to twelve second muted loops, under
20MB, ideally a collage of real project screens so the video doubles as portfolio proof.

## Motion

Opacity and transform only, 150 to 250ms, consistent easing. Nothing that shifts
layout. One orchestrated moment per page rather than a reveal on every section. All
motion respects `prefers-reduced-motion`.

## Accessibility

Contrast verified at token level. Visible focus ring: `3px solid primary`, 2px offset.
Full keyboard operability including the mega menu, modal (focus trapped, Escape closes,
focus returns to the trigger) and the before and after slider (range input fallback).
Semantic landmarks, correct heading order, labelled inputs with described errors, alt
text on every meaningful image and `aria-hidden` on decorative ones.
