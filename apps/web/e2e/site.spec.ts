import { expect, test } from '@playwright/test';

/**
 * The site layout every page family renders inside (docs/10-site-pages.md), checked on the
 * one page it ships with: the HTML sitemap. Runs against the placeholder database, where
 * site.indexing is off.
 */
const PAGE = '/sitemap/';

interface JsonLdNode {
  '@type'?: string;
  itemListElement?: { position: number; name: string; item: string }[];
}

test.describe('site layout', () => {
  test('renders the chrome around the page, noindex, with one h1 and no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(PAGE);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/[^/]+\/sitemap\/$/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Sitemap');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main#main')).toBeVisible();
    await expect(page.locator('footer')).toBeAttached();
    await expect(page.locator('[data-conversion-band] h2')).toBeAttached();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);

    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveText('Skip to content');
    await expect(focused).toHaveAttribute('href', '#main');

    expect(errors).toEqual([]);
  });

  test('has breadcrumbs with the current page marked, and BreadcrumbList and Organization data', async ({ page }) => {
    await page.goto(PAGE);
    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumbs.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/');
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText('Sitemap');

    const nodes = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
      (text) => JSON.parse(text) as JsonLdNode,
    );
    const trail = nodes.find((node) => node['@type'] === 'BreadcrumbList');
    expect(trail?.itemListElement?.map((item) => [item.position, item.name])).toEqual([
      [1, 'Home'],
      [2, 'Sitemap'],
    ]);
    expect(trail?.itemListElement?.[1]?.item).toMatch(/^https:\/\/[^/]+\/sitemap\/$/);
    expect(nodes.some((node) => node['@type'] === 'Organization')).toBe(true);
  });

  test('links in the chrome work from any page: none is a bare in-page anchor', async ({ page }) => {
    await page.goto(PAGE);
    const hrefs = await page
      .locator('header a, footer a, [data-conversion-band] a, [data-floating-cta]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(10);
    expect(hrefs.filter((href) => href.startsWith('#'))).toEqual([]);
  });

  test('robots.txt disallows crawling while the site is not indexable, and sitemap.xml lists the pages', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toMatch(/^Disallow: \/$/m);

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    const xml = await sitemap.text();
    expect(xml).toMatch(/<loc>https:\/\/[^<]+\/sitemap\/<\/loc>/);
    expect(xml).toMatch(/<loc>https:\/\/[^<]+\/<\/loc>/);
  });

  test('shares with the generated preview image', async ({ page, request }) => {
    await page.goto(PAGE);
    const image = await page.locator('meta[property="og:image"]').first().getAttribute('content');
    expect(image).toMatch(/^https:\/\/[^/]+\/opengraph-image/);
    const response = await request.get(image ?? '');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  });

  test('an unknown page answers 404', async ({ request }) => {
    const response = await request.get('/this-page-does-not-exist/');
    expect(response.status()).toBe(404);
  });
});
