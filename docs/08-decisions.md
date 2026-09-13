# 08. Decisions

Decisions taken after the handoff, with the reason for each. When one changes, update
it here and in `CLAUDE.md` in the same commit.

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-09-13 | The GitHub repository is public. | Owner's decision. Nothing secret or client-confidential goes into the repo. |
| 2 | 2026-09-13 | Tailwind CSS v4. Tokens live in `packages/config/tailwind/theme.css` under `@theme`. There is no `tailwind.config.ts`. The default palette is removed, so only tokens exist as colour utilities. | Next.js 16 ships with v4. Removing the palette enforces the token rule at build time. |
| 3 | 2026-09-13 | `apps/web` never touches the database. Server components and server actions call the API. Lint enforces this with `no-restricted-imports`. | Business rules stay in one place. This resolves the conflict between `CLAUDE.md` and `docs/07`. |
| 4 | 2026-09-13 | The API owns identity, sessions and RBAC. Auth.js is dropped and there is no external auth service. The API is served on the site origin at `/api` through Traefik, which strips the prefix. Session cookies are first-party, httpOnly, Secure and `SameSite=Strict`. No CORS is configured. | Owner's decision. A single origin keeps cookies first-party and removes CORS. Business rules and access control live in one service. |
| 5 | 2026-09-13 | Pinned versions: TypeScript 5.9, ESLint 9, NestJS 11, Prisma 7.10, Vitest 4, pnpm 10.32, Next.js 16.3.5 with React 19.2.8. | The newer majors are not usable yet. `typescript-eslint` does not support TypeScript 7. NestJS 12 is ESM-only. Prisma 8 is still a release candidate. Revisit quarterly. |
| 6 | 2026-09-13 | Prisma 7 uses the `prisma-client` generator with CommonJS output and the `pg` driver adapter. The connection URL lives in `packages/db/prisma.config.ts`. | Prisma 7 requires the adapter. CommonJS matches NestJS 11. |
| 7 | 2026-09-13 | SEO fields are stored as `seo Json?` and validated by `seoSchema`, not as a Prisma composite type. | Composite types are MongoDB-only, so the original schema did not validate. |
| 8 | 2026-09-13 | Campaign landing pages are one `LandingPage` record per campaign. Campaign copy lives in `content`, validated by `landingPageContentSchema`. Proof comes from shared types. New shared types: `ProcessStep`, `PricingTier`, `ClientLogo`. | Pages publish without a deploy and without a page builder. Proof is never duplicated per campaign. |
| 9 | 2026-09-13 | Campaign pages are not prerendered at build. They render on first request and revalidate every 300 seconds. | CI builds cannot reach a production API. |
| 10 | 2026-09-13 | The campaign landing shell is 1320px with 48px gutters from `lg` (`shell-narrow`). The site shell stays at 1440px / 56px. | This matches the approved `reference/landing-page.html`. |
| 11 | 2026-09-13 | Teal is split into two tokens. `result` is only for outcome figures and affirmative marks (check icons, status dots). `--glow-teal` is only for ambient glows. Teal is banned from headings, body text, buttons, links, borders and card backgrounds. Enforced by the `calwebtech/teal-usage` lint rule. | Owner's decision. It resolves the conflict between the mockups' decorative teal and the rule that teal signals results. |
| 12 | 2026-09-13 | `pnpm lh` runs Lighthouse CI three times against the built API and web app on a seeded database and asserts on the median run. The gates are 90+ in every category, LCP under 2.5s, CLS under 0.1, Total Blocking Time under 200ms (the lab proxy for INP) and script transfer under 150KB. The page and image caches are warmed first, and the page is served over HTTP/2 + TLS through a local proxy, because `next start` only speaks HTTP/1.1. Campaign pages skip the `is-crawlable` audit because they are noindex by design. | These are the budget gates from `CLAUDE.md`, measured the way production serves the page. Traefik serves HTTP/2 over TLS. Over HTTP/1.1, simulated LCP for the same build came out about 370ms worse (2.85s against 2.48s locally), because Lighthouse's simulation models the connections it observes. Thresholds and throttling method are unchanged. |
| 13 | 2026-09-13 | The release workflow runs on pull requests too. Images are built on every run and pushed only from `main`. Deploy stays off until the repository variable `DEPLOY_ENABLED` is `true`. | CI must be green before merge. There is no VPS yet. |

## Open

- Lead forms still lack Turnstile, the confirmation email and the internal notification.
  The Task 1.5 gate requires all three. This is next, before the homepage.
- The deploy job calls `node dist/migrate.js`, which does not exist yet. A migration
  runner is needed before `DEPLOY_ENABLED` is switched on.
