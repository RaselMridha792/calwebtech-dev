import page from './page.json';

/*
 * Snapshot of the calculator family's API response (docs/10-site-pages.md). The page renders
 * it while `API_INTERNAL_URL` is unset, so the Vercel demo shows the real copy, the published
 * bands and the published rates. The file is exactly what `GET /pages/cost-calculator`
 * returns, including the rate table and the event names the pricing model produces.
 *
 * Nothing here decides a price: a visitor's estimate always comes back from the API, which
 * recomputes it from the answers (packages/shared/src/calculator.ts).
 */
export const calculatorPageSnapshot: unknown = page;
