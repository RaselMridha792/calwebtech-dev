# 09. Performance Budget in Practice

Read this before building any marketing route.

## Lab and field

Everything below is **lab** measurement: a simulated phone on a simulated network. Lab
numbers are a proxy that stops regressions before they ship. The real gate is **field
Core Web Vitals at p75**, from real visitors on mobile: LCP under 2.5s, INP under 200ms
and CLS under 0.1. Field data takes priority once Umami is collecting it (Web Vitals
reported as Umami events). When lab and field disagree, field is right and the lab
setup gets fixed.

## Two budgets

| Budget | Gate | Command |
|---|---|---|
| Initial JS per marketing route, framework included | under 150 kB gzip | `pnpm lh` (Lighthouse, `resource-summary`) |
| Own client JS per route, framework excluded | under 20 kB gzip | `pnpm --filter @calwebtech/web budget` |

**Framework** means React, React DOM, the Next.js runtime and the Turbopack runtime.
**Own code** is everything else that reaches the browser: our components, workspace
packages and any third-party library we add. The two are gated separately so that a
Next.js upgrade that grows the framework shows up as framework growth. It must not
silently eat the page budget and look like page bloat.

`pnpm --filter @calwebtech/web analyze [route]` breaks a route down by module.

## Where the bytes go

Gzip, in kB (1000 bytes), from the analysis build, September 2026, Next.js 16.3.5 and
React 19.2.8.

| Part | `/lp/[campaign]` |
|---|---|
| Framework: React DOM, App Router runtime, Turbopack runtime | 139.3 kB |
| **Own code** | **6.6 kB** |

Own code on the landing page:

| Module | Size |
|---|---|
| Lead form, with the on-demand Turnstile loader | 2.8 kB |
| Process stepper | 1.1 kB |
| Before/after slider | 0.8 kB |
| Anchor scroll | 0.7 kB |
| Count-up | 0.5 kB |
| Icons | 0.4 kB |
| Reveal observer | 0.3 kB |

Turnstile's own script (`challenges.cloudflare.com`) is not in these numbers and not in
initial JS. It loads when a visitor first touches a form.

With the framework at about 139 kB, roughly 11 kB of the 150 kB total is left for a
route's own code. The 20 kB own-code gate is a ceiling, not an allowance; the total
gate binds first.

## Rules for marketing routes

- **Do not import `next/image`.**
  - Its entry point requires the `'use client'` image component, which ships about 4 kB
    to every page, even when `<Image>` is never rendered.
  - Use `components/ui/responsive-image.tsx`, backed by `lib/image-props.ts`.
  - It renders width and height (sized images), `sizes`, `loading`, `decoding` and
    `fetchpriority="high"` on the LCP image.
  - Sources still come from the Next.js optimiser (`/_next/image`) until the media
    pipeline stores responsive variants.
- **Prefer native behaviour to script.**
  - Accordions: exclusive `<details name>`.
  - Pause toggles: CSS `:checked`.
  - Menus: `:focus-within`.
  - Modals: `<dialog>`.
- **Render content on the server and pass it into client components** as props or
  children, so the client component only owns state.
- **Load heavy or below-the-fold widgets on interaction or visibility.** That covers the
  cost calculator, video modal and booking calendar, through `next/dynamic`, with a
  server-rendered fallback.
- **Load third-party scripts on interaction, never at page load.** Turnstile loads when a
  visitor first focuses or touches a form (`lib/turnstile-client.ts`), so it adds nothing
  to initial JS, TBT or LCP. Load it from Cloudflare's own URL; Cloudflare does not
  support a proxied or cached copy.
- **Use `content-auto` on below-the-fold sections.**
  - It moved first paint from about 0.9s to 0.7s at 4x CPU, with no layout shift.
  - Never use it on the section that holds the LCP element.
  - Never set CSS `scroll-behavior: smooth`. It fixes the destination when the scroll
    starts, the skipped sections then render at their real height, and deep links landed
    635 to 1348px off. `components/motion/anchor-scroll.tsx` smooths in-page links instead
    and re-reads the target's position on every frame. Cold deep links jump instantly,
    which the browser keeps in place while sections render.
  - `e2e/anchors.spec.ts` checks that every in-page link (smooth and reduced motion,
    starting from the top and the bottom) and every deep link lands on its section.
- **No `backdrop-filter` on sticky or full-width elements.** It costs paint time on
  every frame.
- **Keep decorative backdrops small.** `BackdropImage` uses quality 50 and half-width
  `sizes` below `lg`.

## How the gate measures

`pnpm lh` runs `packages/perf`:

1. **Serve.** The built API and web app run behind a local edge proxy. The proxy reads
   `infra/traefik/dynamic/edge.yml`, the same file Traefik loads in production. It mirrors
   the TLS versions, cipher suites, curves, ALPN (HTTP/2) and compression. Any setting the
   proxy cannot mirror fails the perf package tests, so a Traefik change forces a review
   here. Page, asset and image caches are warmed first, as they are after production's
   first visitor.
2. **Calibrate.** Lighthouse's simulated throttling multiplies the CPU time it observes
   by `cpuSlowdownMultiplier`. With a fixed 4x, a slower or busier host produces worse
   scores for the same build. Three calibration runs therefore measure the host's
   benchmark index, and the fastest counts, because contention only ever slows a run
   down. The multiplier becomes `4 × benchmarkIndex / 2400`, clamped to 1–8. 2400 is a
   typical GitHub-hosted runner, which keeps 4x there.
3. **Collect.** Measured runs repeat until five are healthy, up to ten attempts. A run
   whose benchmark index leaves 90–110% of calibration is discarded, not averaged in.
   Below the band the host was contended and the simulation is too strict. Above it,
   calibration itself was contended and the simulation would be too lenient. Without
   five healthy runs the gate fails and says the host was too unstable. It never passes
   on a guess. On a busy workstation that is the expected outcome; CI is the gate.
4. **Assert.** Lighthouse CI asserts the budget on the median of the five runs.

Two known properties of the simulation:

- **LCP counts almost everything that loaded.** Simulated LCP includes every request
  that finished before the observed LCP, including async framework scripts. On
  localhost that is nearly the whole initial payload, so fonts, HTML and client JS all
  count against the 2.5s LCP gate.
- **The transport matters.** Measuring over HTTP/1.1 instead of production's HTTP/2
  made LCP about 370ms worse for the same build.

## Checking the lab against real Traefik

Once staging exists, run the gate once behind the real Traefik and compare. Repeat
whenever `edge.yml`, the Traefik version or the Cloudflare setup changes.

```
pnpm lh                                    # local edge proxy -> packages/perf/.lighthouseci
LH_EXTRA_HEADERS='{"Authorization":"Basic <staging credentials>"}' \
  pnpm --filter @calwebtech/perf exec node src/collect.mjs --no-serve \
  --url https://staging.calwebtech.com/lp/b2b-website-design/ --out .lighthouseci-staging
pnpm --filter @calwebtech/perf compare .lighthouseci .lighthouseci-staging
```

`compare` fails when any median diverges beyond tolerance:

- performance score: 0.05
- FCP and LCP: 15%, at least 150ms
- TBT: 25%, at least 50ms
- CLS: 0.02
- script bytes: 5%, at least 5 kB

A divergence means the lab gate no longer predicts production. It is fixed before the
gate is trusted again. If Cloudflare sits in front of staging, compare against the
Traefik origin first, so the proxy is checked against what it claims to mirror.

## What is not reducible

The largest main-thread task is framework module evaluation, together with layout while
streamed HTML arrives. Keep client code small, and add no synchronous work during
hydration.
