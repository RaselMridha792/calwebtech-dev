# 09. Performance Budget in Practice

Measured on `/lp/[campaign]/` in September 2026 with Next.js 16.3.5 and React 19.2.8.
Read this before building any marketing route. Re-measure after every UI task with
`pnpm --filter @calwebtech/web analyze [route]`. `pnpm lh` is the release gate.

## Where the 150KB goes

Gzip sizes from the analysis build. In production, 135.8KB is actually transferred.

| Part | Gzip | Reducible by us |
|---|---|---|
| React DOM | 57KB | No |
| Next.js App Router runtime (segment cache, router reducer, RSC client, app index, errors) | ~62KB | No |
| Turbopack runtime | 4KB | No |
| Per-route framework (layout router, error boundaries) | 4KB | No |
| **Landing page client code** | **5KB** | Yes |

The landing page's own client code breaks down as: lead form 2.0KB, process stepper
1.0KB, before/after slider 0.8KB, count-up 0.4KB, icons 0.4KB, reveal observer 0.3KB.

**About 132KB is framework and ships on every route.** That leaves roughly 14KB for
all of a page's own client JavaScript. The homepage has to fit in that too.

## Rules for marketing routes

- **Do not import `next/image`.** Its entry point requires the `'use client'` image
  component, which ships about 4KB to every page, even when `<Image>` is never rendered.
  Use `components/ui/responsive-image.tsx`, backed by `lib/image-props.ts`.
- **Prefer native behaviour to script.**
  - Accordions: exclusive `<details name>`.
  - Pause toggles: CSS `:checked`.
  - Menus: `:focus-within`.
  - Modals: `<dialog>`.
- **Render content on the server and pass it into client components.** Pass it as
  props or children, so the client component only owns state. The process stepper and
  before/after slider work this way.
- **Load heavy or below-the-fold widgets on demand.** The cost calculator, video modal
  and booking calendar load on interaction or visibility through `next/dynamic`, with a
  server-rendered fallback. They never go in the initial bundle.
- **Use `content-auto` on below-the-fold sections.** It moved first paint from about
  0.9s to 0.7s at 4x CPU, with no layout shift. Never use it on the section that holds
  the LCP element.
- **No `backdrop-filter` on sticky or full-width elements.** It costs paint time on
  every frame.
- **Keep decorative backdrops small.** Use `BackdropImage`, which applies quality 50 and
  half-width `sizes` below `lg`. On mobile the hero backdrop is the LCP element, and
  under Lighthouse's simulated 1.6Mbps connection its bytes share bandwidth with the
  whole initial payload. On CI, network load time was 1.9s of a 2.7s LCP, while the
  real (unthrottled) LCP was about 0.2s.

## What is not reducible

The largest main-thread task is framework module evaluation, together with layout
while the streamed HTML arrives. It runs for 400–550ms at 4x CPU on a mid-range laptop,
and it grows with every module evaluated on load. Keep client code small, and add no
synchronous work during hydration.

Lighthouse's simulated LCP counts every request that finished before the observed
LCP, including async framework scripts. On localhost everything finishes within
milliseconds, so the page's whole initial payload (about 250KB) is modelled as
downloading over 1.6Mbps before LCP. That puts roughly 2.2–2.5s of LCP on any App
Router page with two web fonts, before any page-specific cost. Every kilobyte of
fonts, HTML and client JavaScript on a marketing route counts against that 2.5s gate.

Lighthouse varies a lot on developer machines. The same build scored TBT anywhere from
243ms to 484ms across local runs. Compare variants by alternating them in the same
session, and treat the Linux CI run as the source of truth.
