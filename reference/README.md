# Reference mockups

These two files are client-approved. Open them in a browser before building any
component and match what you see.

| File | What it is |
|---|---|
| `homepage.html` | The approved homepage, every section, with working interactions |
| `landing-page.html` | The approved campaign landing template for `/lp/<campaign>/` |

## What to carry over

Tokens, type scale, spacing rhythm, section order, component composition, the
background-video pattern, and the interaction behaviour (mega menu, work filter tabs,
FAQ accordion, before-and-after slider, showreel modal, recognition tabs, counters).

## What NOT to carry over

- Tailwind is loaded from the CDN here so the file runs standalone. The real build
  uses a compiled Tailwind config.
- Client names, metrics, testimonials, addresses, phone numbers and awards are all
  placeholder data. Replace every one with content supplied by Calwebtech.
- Images point at Unsplash. Replace with the client's own photography and project
  screens where available.
- Markup here is written for a single file. In the build it becomes typed, prop-driven
  components reading from the database.

## Video assets

Both mockups expect:

```
public/assets/calwebtech-showreel.mp4
public/assets/calwebtech-showcase-bg.mp4
```

Until those exist, the poster image with a slow Ken Burns transform stands in and
nothing breaks. Keep that fallback in the real build.
