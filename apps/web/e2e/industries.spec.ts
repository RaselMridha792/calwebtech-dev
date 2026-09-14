import { expect, test, type Page } from '@playwright/test';

/**
 * The industries family (docs/10-site-pages.md) against the placeholder database CI uses:
 * seven placeholder industries with an answer block and no page copy, the placeholder
 * `industries.index` setting, and, when `pnpm db:seed:fixtures` ran, one test industry
 * with its copy sections filled. site.indexing is off, so every page is noindex.
 */
const INDEX = '/industries/';
/** A placeholder industry from the launch seed (HOME_INDUSTRIES), and a snapshot page on the demo. */
const INDUSTRY = '/industries/manufacturing/';
/** packages/db/src/seed/pages/industries.ts, FIXTURE_INDUSTRY_SLUG. */
const FIXTURE = '/industries/e2e-fixture-industry/';

interface JsonLdNode {
  '@type'?: string;
  itemListElement?: { position: number; name: string; item: string }[];
}

async function jsonLd(page: Page): Promise<JsonLdNode[]> {
  return (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
    (text) => JSON.parse(text) as JsonLdNode,
  );
}

/** Collects uncaught errors and console errors for the page's lifetime. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

/** The answer block comes before every link in main except the breadcrumbs (CLAUDE.md, SEO). */
async function answerBlockLeads(page: Page): Promise<boolean> {
  return page.locator('main').evaluate((main) => {
    const answer = main.querySelector('[data-answer-block]');
    if (!answer) return false;
    const links = [...main.querySelectorAll('a')].filter((link) => !link.closest('nav[aria-label="Breadcrumb"]'));
    return links.every((link) => Boolean(answer.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
}

async function expectSiteBasics(page: Page, path: string): Promise<void> {
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    new RegExp(`^https://[^/]+${path.replaceAll('/', '\\/')}$`),
  );
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main#main [data-answer-block]')).toHaveCount(1);
  expect(await answerBlockLeads(page), 'the answer block precedes every call to action').toBe(true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);
}

test.describe('industries index', () => {
  test('is noindex with one h1, the answer block first, breadcrumbs and no errors', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(INDEX);
    await expectSiteBasics(page, INDEX);

    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumbs.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/');
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText('Industries');
    const trail = (await jsonLd(page)).find((node) => node['@type'] === 'BreadcrumbList');
    expect(trail?.itemListElement?.map((item) => item.name)).toEqual(['Home', 'Industries']);
    expect(errors).toEqual([]);
  });

  test('lists each published industry as one link, or says nothing is published yet', async ({ page }) => {
    await page.goto(INDEX);
    const list = page.locator('#industries');
    const cards = list.locator('ul > li a[href^="/industries/"]');
    const count = await cards.count();
    if (count === 0) {
      // The empty state names what will appear and links on to the contact page.
      await expect(list.locator('.border-dashed')).toBeVisible();
      return;
    }
    const hrefs = await cards.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    for (const href of hrefs) expect(href).toMatch(/^\/industries\/[a-z0-9-]+\/$/);
    expect(hrefs).toContain(INDUSTRY);
  });

  test('a card opens its industry from the keyboard', async ({ page }) => {
    await page.goto(INDEX);
    const link = page.locator(`#industries a[href="${INDUSTRY}"]`);
    test.skip((await link.count()) === 0, 'No industry is published in this database.');
    await link.focus();
    await expect(link).toBeFocused();
    await Promise.all([page.waitForURL(`**${INDUSTRY}`), page.keyboard.press('Enter')]);
    await expect(page.locator('h1')).toHaveCount(1);
  });
});

test.describe('industry page', () => {
  test('is noindex with one h1, the answer block first, breadcrumbs and structured data', async ({ page }) => {
    const errors = watchErrors(page);
    const response = await page.goto(INDUSTRY);
    expect(response?.status()).toBe(200);
    await expectSiteBasics(page, INDUSTRY);

    // The answer block sits straight under the H1.
    const next = await page
      .locator('h1')
      .evaluate((heading) => heading.nextElementSibling?.hasAttribute('data-answer-block') ?? false);
    expect(next).toBe(true);

    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumbs.getByRole('link', { name: 'Industries', exact: true })).toHaveAttribute('href', INDEX);
    const nodes = await jsonLd(page);
    const trail = nodes.find((node) => node['@type'] === 'BreadcrumbList');
    expect(trail?.itemListElement?.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(trail?.itemListElement?.[2]?.item).toMatch(/\/industries\/manufacturing\/$/);
    expect(nodes.filter((node) => node['@type'] === 'Service')).toHaveLength(1);
    expect(nodes.filter((node) => node['@type'] === 'FAQPage').length).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('section headings on the page are questions buyers type', async ({ page }) => {
    await page.goto(INDUSTRY);
    const headings = await page.locator('main h2').allTextContents();
    for (const heading of headings) expect(heading.trim()).toMatch(/\?$/);
  });

  test('an unknown or malformed slug answers 404', async ({ request }) => {
    for (const path of ['/industries/not-an-industry/', '/industries/constructor/', '/industries/Manufacturing/']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
    }
  });

  test('every section of the fixture industry renders, and its FAQ works from the keyboard', async ({ page }) => {
    const response = await page.goto(FIXTURE);
    test.skip(response?.status() === 404, 'The end-to-end fixtures are not seeded in this database.');
    await expectSiteBasics(page, FIXTURE);

    await expect(page.locator('#industry-challenges h3')).toHaveCount(4);
    await expect(page.locator('#industry-compliance h3')).toHaveCount(1);
    await expect(page.locator('#industry-integrations h3')).toHaveCount(1);

    const faqs = page.locator('details[name="industry-faq"]');
    await expect(faqs).toHaveCount(2);
    await faqs.nth(1).locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(faqs.nth(1)).toHaveAttribute('open', '');
    await expect(faqs.nth(0)).not.toHaveAttribute('open', '');

    const types = (await jsonLd(page)).map((node) => node['@type']);
    expect(types.filter((type) => type === 'FAQPage')).toHaveLength(1);
    expect(types).toContain('Service');
  });
});

test('sitemap.xml lists the industries index and industry pages', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.ok()).toBe(true);
  const xml = await response.text();
  expect(xml).toMatch(/<loc>https:\/\/[^<]+\/industries\/<\/loc>/);
  expect(xml).toMatch(/<loc>https:\/\/[^<]+\/industries\/manufacturing\/<\/loc>/);
});
