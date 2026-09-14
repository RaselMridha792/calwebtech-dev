import { expect, test, type Page } from '@playwright/test';

/**
 * The company family (docs/10-site-pages.md), against the database CI seeds: each page's copy
 * is a placeholder setting and no proof records exist. The company fixtures
 * (packages/db/src/seed/pages/company.ts) add two test questions each to /awards/ and /team/
 * and one test team member, shown on /team/ and /about/; partners, awards, technologies and
 * testimonials stay empty, so those lists show their empty state. Checks that depend on
 * records hold either way.
 */
const PAGES = [
  { path: '/about/', crumb: 'About', lists: ['team', 'recognition'] },
  { path: '/team/', crumb: 'Team', lists: ['team'] },
  { path: '/testimonials/', crumb: 'Testimonials', lists: ['testimonials', 'ratings'] },
  { path: '/awards/', crumb: 'Awards', lists: ['awards', 'partners'] },
  { path: '/partners/', crumb: 'Partners', lists: ['partners'] },
  { path: '/technology/', crumb: 'Technology', lists: ['technology'] },
] as const;

/** The about page's recognition section lists awards and partners under one empty state. */
const LIST_SELECTORS: Record<string, string> = {
  recognition: '[data-company-list="awards"], [data-company-list="partners"]',
};

interface JsonLdNode {
  '@type'?: string;
  itemListElement?: { position: number; name: string }[];
}

async function jsonLd(page: Page): Promise<JsonLdNode[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.flatMap((text) => {
    const data = JSON.parse(text) as JsonLdNode | JsonLdNode[];
    return Array.isArray(data) ? data : [data];
  });
}

test.describe('company pages', () => {
  for (const { path, crumb, lists } of PAGES) {
    test(`${path} renders one h1, noindex, breadcrumbs and no overflow or errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });

      const response = await page.goto(path);
      expect(response?.status()).toBe(200);

      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`^https?://[^/]+${path}$`));
      await expect(page.locator('h1')).toHaveCount(1);

      const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
      await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText(crumb);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);

      expect(errors).toEqual([]);
    });

    test(`${path} opens with the answer block before any call to action, and keeps headings in order`, async ({ page }) => {
      await page.goto(path);
      const answer = page.locator('main [data-answer-block]');
      await expect(answer).toHaveCount(1);

      const order = await page.evaluate(() => {
        const main = document.querySelector('main');
        const block = main?.querySelector('[data-answer-block]');
        const h1 = main?.querySelector('h1');
        if (!main || !block || !h1) return { answerAfterH1: false, linksBeforeAnswer: -1, skipped: [] as string[] };
        const links = [...main.querySelectorAll('a[href]')].filter((link) => !link.closest('nav[aria-label="Breadcrumb"]'));
        const levels = [...main.querySelectorAll('h1, h2, h3, h4')].map((heading) => Number(heading.tagName.slice(1)));
        const skipped = levels.flatMap((level, index) =>
          index > 0 && level > (levels[index - 1] ?? 1) + 1 ? [`h${String(levels[index - 1])} then h${String(level)}`] : [],
        );
        return {
          answerAfterH1: Boolean(h1.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING),
          linksBeforeAnswer: links.filter((link) => link.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).length,
          skipped,
        };
      });
      expect(order.answerAfterH1).toBe(true);
      expect(order.linksBeforeAnswer, 'no call to action before the answer block').toBe(0);
      expect(order.skipped, 'no skipped heading levels').toEqual([]);
    });

    test(`${path} shows each list or its empty state`, async ({ page }) => {
      await page.goto(path);
      for (const list of lists) {
        const records = await page.locator(LIST_SELECTORS[list] ?? `[data-company-list="${list}"]`).count();
        const empty = page.locator(`[data-company-empty="${list}"]`);
        if (records === 0) {
          await expect(empty, `${list} shows its empty state`).toBeAttached();
          await expect(empty).not.toBeEmpty();
        } else {
          await expect(empty).toHaveCount(0);
        }
      }
    });
  }

  test('structured data: one Organization, a breadcrumb trail, and reviews only where they exist', async ({ page }) => {
    await page.goto('/testimonials/');
    const nodes = await jsonLd(page);
    expect(nodes.filter((node) => node['@type'] === 'Organization')).toHaveLength(1);
    expect(nodes.find((node) => node['@type'] === 'BreadcrumbList')?.itemListElement?.map((item) => item.name)).toEqual([
      'Home',
      'Testimonials',
    ]);

    const quotes = await page.locator('[data-testimonial]').count();
    expect(nodes.filter((node) => node['@type'] === 'Review')).toHaveLength(quotes);
    const ratingCard = await page.locator('[data-rating-card]').count();
    expect(nodes.filter((node) => node['@type'] === 'AggregateRating')).toHaveLength(ratingCard);

    await page.goto('/team/');
    const people = await page.locator('[data-team-member]').count();
    expect(people, 'the team page lists at least one person').toBeGreaterThan(0);
    expect((await jsonLd(page)).filter((node) => node['@type'] === 'Person')).toHaveLength(people);

    await page.goto('/about/');
    expect((await jsonLd(page)).some((node) => node['@type'] === 'AboutPage')).toBe(true);
  });

  test('the placeholder pages make no claims they cannot back up', async ({ page }) => {
    for (const { path } of PAGES) {
      await page.goto(path);
      if ((await page.locator('[data-company-list]').count()) > 0) continue;
      const text = await page.locator('main').evaluate((main) => main.textContent);
      expect(text, `${path}: no star ratings`).not.toContain('★');
      expect(text, `${path}: no percentage figures`).not.toMatch(/\d\s?%/);
    }
  });

  test('FAQ answers open from the keyboard when a page has questions', async ({ page }) => {
    const exercised: string[] = [];
    for (const { path } of PAGES) {
      await page.goto(path);
      const summaries = page.locator('#faq summary');
      if ((await summaries.count()) < 2) continue;
      const second = summaries.nth(1);
      await expect(second.locator('xpath=..')).not.toHaveAttribute('open', '');
      await second.focus();
      await page.keyboard.press('Enter');
      await expect(second.locator('xpath=..')).toHaveAttribute('open', '');
      exercised.push(path);
    }
    expect(exercised.length, 'at least one page has questions to open').toBeGreaterThan(0);
  });

  test('the pages are in sitemap.xml, and paths below them answer 404', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    for (const { path } of PAGES) {
      expect(xml).toMatch(new RegExp(`<loc>https?://[^<]+${path}</loc>`));
    }
    expect((await request.get('/team/no-such-person/')).status()).toBe(404);
    expect((await request.get('/awards/no-such-award/')).status()).toBe(404);
  });
});
