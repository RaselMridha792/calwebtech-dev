import { expect, test, type Page } from '@playwright/test';

/**
 * The locations family (docs/10-site-pages.md) against the placeholder database CI uses:
 * the placeholder `locations.index` setting and no location records, because a city page
 * needs honest local copy a placeholder cannot give, and the homepage's locations section
 * must stay empty (home.spec.ts). The city page tests run wherever Sacramento is published,
 * such as the snapshot demo. Where it is not, which today includes CI, they are skipped
 * with a "coverage gap" annotation, so the report shows the [city] template went
 * unchecked rather than passing quietly. Closing the gap needs a published Location
 * fixture with home.spec.ts accepting it, or a run against the snapshots.
 * site.indexing is off, so every page is noindex.
 */
const INDEX = '/locations/';
/** An office in the approved homepage content, and a snapshot page on the demo. */
const CITY = '/locations/sacramento/';

interface JsonLdNode {
  '@type'?: string;
  itemListElement?: { position: number; name: string; item: string }[];
  address?: { '@type'?: string };
  areaServed?: unknown[];
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

/** Section headings on content pages are questions buyers type. */
async function expectQuestionHeadings(page: Page): Promise<void> {
  const headings = await page.locator('main h2').allTextContents();
  expect(headings.length).toBeGreaterThan(0);
  for (const heading of headings) expect(heading.trim(), heading).toMatch(/\?$/);
}

test.describe('locations index', () => {
  test('is noindex with one h1, the answer block first, breadcrumbs and no errors', async ({ page }) => {
    const errors = watchErrors(page);
    const response = await page.goto(INDEX);
    expect(response?.status()).toBe(200);
    await expectSiteBasics(page, INDEX);

    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumbs.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/');
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText('Locations');
    const trail = (await jsonLd(page)).find((node) => node['@type'] === 'BreadcrumbList');
    expect(trail?.itemListElement?.map((item) => item.name)).toEqual(['Home', 'Locations']);
    expect(errors).toEqual([]);
  });

  test('lists published locations grouped by tier, or says nothing is published yet', async ({ page }) => {
    await page.goto(INDEX);
    const cards = page.locator('main section[id^="tier-"] li a[href^="/locations/"]');
    const count = await cards.count();
    if (count === 0) {
      const empty = page.locator('#no-locations .border-dashed');
      await expect(empty).toBeVisible();
      await expect(empty.getByRole('link')).toHaveAttribute('href', '/contact/');
      return;
    }
    await expectQuestionHeadings(page);
    const hrefs = await cards.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    for (const href of hrefs) expect(href).toMatch(/^\/locations\/[a-z0-9-]+\/$/);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    await expect(page.locator('#no-locations')).toHaveCount(0);
  });

  test('a location card opens its city page from the keyboard', async ({ page }) => {
    await page.goto(INDEX);
    const link = page.locator('main section[id^="tier-"] li a[href^="/locations/"]').first();
    const none = (await link.count()) === 0;
    if (none) {
      test.info().annotations.push({
        type: 'coverage gap',
        description: 'No location is published in this database, so opening a card from the keyboard was not checked here.',
      });
    }
    test.skip(none, 'No location is published in this database.');
    const href = (await link.getAttribute('href')) ?? '';
    await link.focus();
    await expect(link).toBeFocused();
    await Promise.all([page.waitForURL(`**${href}`), page.keyboard.press('Enter')]);
    await expect(page.locator('h1')).toHaveCount(1);
  });
});

/**
 * Opens the city page, or skips the test with a visible annotation when this database has
 * no published Sacramento, so the missing template coverage is reported, not hidden.
 */
async function openCity(page: Page): Promise<void> {
  const response = await page.goto(CITY);
  const missing = response?.status() === 404;
  if (missing) {
    test.info().annotations.push({
      type: 'coverage gap',
      description: `${CITY} is not published in this database, so the city page template was not checked here.`,
    });
  }
  test.skip(missing, 'Sacramento is not published in this database.');
}

test.describe('city page', () => {
  test('is noindex with one h1, the answer block straight under it, breadcrumbs and structured data', async ({ page }) => {
    const errors = watchErrors(page);
    await openCity(page);
    await expectSiteBasics(page, CITY);

    const next = await page
      .locator('h1')
      .evaluate((heading) => heading.nextElementSibling?.hasAttribute('data-answer-block') ?? false);
    expect(next, 'the answer block sits straight under the H1').toBe(true);

    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumbs.getByRole('link', { name: 'Locations', exact: true })).toHaveAttribute('href', INDEX);
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText('Sacramento');

    const nodes = await jsonLd(page);
    const trail = nodes.find((node) => node['@type'] === 'BreadcrumbList');
    expect(trail?.itemListElement?.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(trail?.itemListElement?.[2]?.item).toMatch(/\/locations\/sacramento\/$/);
    const business = nodes.find((node) => node['@type'] === 'ProfessionalService');
    expect(business?.address?.['@type']).toBe('PostalAddress');
    expect(business?.areaServed?.length ?? 0).toBeGreaterThan(0);
    expect(nodes.filter((node) => node['@type'] === 'FAQPage')).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('has question headings, a local number to call, and at most six links to other locations', async ({ page }) => {
    await openCity(page);
    await expectQuestionHeadings(page);

    const call = page.locator('main a[href^="tel:+"]');
    expect(await call.count()).toBeGreaterThan(0);
    await expect(page.locator('#local-contact a[href^="tel:+"]')).toHaveCount(1);

    const nearby = page.locator('#other-locations li a[href^="/locations/"]');
    expect(await nearby.count()).toBeLessThanOrEqual(6);
    const hrefs = await nearby.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    expect(hrefs).not.toContain(CITY);
  });

  test('its FAQs open and close from the keyboard', async ({ page }) => {
    await openCity(page);
    const faqs = page.locator('details[name="location-faq"]');
    const count = await faqs.count();
    expect(count).toBeGreaterThanOrEqual(4);
    expect(count).toBeLessThanOrEqual(5);

    const second = faqs.nth(1);
    await second.locator('summary').scrollIntoViewIfNeeded();
    await second.locator('summary').focus();
    await expect(second.locator('summary')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(second).toHaveAttribute('open', '');
    await expect(faqs.nth(0)).not.toHaveAttribute('open', '');
  });
});

test('an unknown or malformed city answers 404', async ({ request }) => {
  for (const path of ['/locations/not-a-city/', '/locations/constructor/', '/locations/Sacramento/']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});

test('sitemap.xml lists the locations index', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.ok()).toBe(true);
  expect(await response.text()).toMatch(/<loc>https:\/\/[^<]+\/locations\/<\/loc>/);
});
