import { expect, test, type Page } from '@playwright/test';

/**
 * The work family (docs/10-site-pages.md): `/work/`, `/work/<slug>/` and `/before-and-after/`,
 * against the placeholder database CI seeds with end-to-end fixtures. The fixtures publish
 * one complete case study and one before and after pair; without them the index pages show
 * their empty states, which these tests accept too.
 */
const INDEX = '/work/';
const BEFORE_AND_AFTER = '/before-and-after/';
/** WORK_FIXTURE_SLUG in packages/db/src/seed/pages/work.ts. */
const FIXTURE = '/work/e2e-fixture-case-study/';

interface JsonLdNode {
  '@type'?: string;
  itemListElement?: { position: number; name: string }[];
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function expectPageBasics(page: Page, canonical: RegExp) {
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);
}

async function jsonLdTypes(page: Page): Promise<JsonLdNode[]> {
  const texts = await page.locator('script[type="application/ld+json"]').allTextContents();
  return texts.flatMap((text) => {
    const parsed = JSON.parse(text) as JsonLdNode | JsonLdNode[];
    return Array.isArray(parsed) ? parsed : [parsed];
  });
}

/** Presses Tab until the focused element matches, as a keyboard user would reach it. */
async function tabTo(page: Page, matches: (element: { text: string; href: string | null; tag: string; type: string | null }) => boolean) {
  for (let presses = 0; presses < 150; presses += 1) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      return {
        text: element?.textContent.trim() ?? '',
        href: element?.getAttribute('href') ?? null,
        tag: element?.tagName.toLowerCase() ?? '',
        type: element?.getAttribute('type') ?? null,
      };
    });
    if (matches(focused)) return;
  }
  throw new Error('The element was not reached with the keyboard');
}

test.describe('work index', () => {
  test('renders with one H1, breadcrumbs, noindex, and case studies or an empty state', async ({ page }) => {
    const errors = collectErrors(page);
    const response = await page.goto(INDEX);
    expect(response?.status()).toBe(200);
    await expectPageBasics(page, /^https:\/\/[^/]+\/work\/$/);

    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumbs.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/');
    await expect(breadcrumbs.locator('[aria-current="page"]')).toBeAttached();
    const trail = (await jsonLdTypes(page)).find((node) => node['@type'] === 'BreadcrumbList');
    expect(trail?.itemListElement?.length).toBe(2);

    const results = page.locator('#work-results');
    await expect(results.locator('h2')).toHaveCount(1);
    const fixtureCard = results.locator(`a[href="${FIXTURE}"]`);
    if ((await fixtureCard.count()) > 0) {
      await expect(results.getByRole('navigation')).toBeAttached();
      await expect(results.locator('dd').first()).toBeAttached();
    } else {
      await expect(results.locator('.border-dashed')).toBeAttached();
    }
    expect(errors).toEqual([]);
  });

  test('a filtered URL loads on the server, canonicalises to /work/ and offers a way back by keyboard', async ({ page }) => {
    const response = await page.goto('/work/?industry=no-such-industry&service=no-such-service');
    expect(response?.status()).toBe(200);
    await expectPageBasics(page, /^https:\/\/[^/]+\/work\/$/);

    const results = page.locator('#work-results');
    const clear = results.locator('a[href="/work/#work-results"]').last();
    if ((await clear.count()) === 0) {
      // Nothing is published: the empty state stands in for the filters.
      await expect(results.locator('.border-dashed')).toBeAttached();
      return;
    }
    await expect(results.locator('.border-dashed')).toBeAttached();
    const label = (await clear.textContent())?.trim() ?? '';
    await tabTo(page, (element) => element.href === '/work/#work-results' && element.text === label);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/work\/#work-results$/);
  });

  test('answers 404 for a page that does not exist', async ({ request }) => {
    expect((await request.get('/work/?page=two')).status()).toBe(404);
    expect((await request.get('/work/?page=9999')).status()).toBe(404);
  });
});

test.describe('case study', () => {
  test('opens with the answer block, carries its figures and Article data, and fits the viewport', async ({ page }) => {
    const errors = collectErrors(page);
    const response = await page.goto(FIXTURE);
    test.skip(response?.status() === 404, 'The end-to-end fixtures are not seeded.');
    expect(response?.status()).toBe(200);
    await expectPageBasics(page, /^https:\/\/[^/]+\/work\/e2e-fixture-case-study\/$/);

    const answer = page.locator('[data-answer-block]');
    await expect(answer).toBeVisible();
    const promotionalBefore = await answer.evaluate((block) => {
      const hero = block.closest('section');
      const h1 = hero?.querySelector('h1');
      if (!hero || !h1) return -1;
      return [...hero.querySelectorAll('a')].filter(
        (link) =>
          (h1.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
          (block.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_PRECEDING) !== 0,
      ).length;
    });
    expect(promotionalBefore, 'nothing between the H1 and the answer block').toBe(0);

    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumbs.getByRole('link', { name: 'Case studies', exact: true })).toHaveAttribute('href', INDEX);
    await expect(breadcrumbs.locator('[aria-current="page"]')).toBeAttached();

    await expect(page.locator('#results dd')).toHaveCount(3);
    const types = (await jsonLdTypes(page)).map((node) => node['@type']);
    expect(types).toContain('Article');
    expect(types).toContain('BreadcrumbList');

    const levels = await page.locator('main :is(h1, h2, h3)').evaluateAll((headings) =>
      headings.map((heading) => Number(heading.tagName.slice(1))),
    );
    for (let index = 1; index < levels.length; index += 1) {
      expect((levels[index] ?? 0) - (levels[index - 1] ?? 0)).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });

  test('answers 404 for an unknown slug', async ({ request }) => {
    expect((await request.get('/work/no-such-case-study/')).status()).toBe(404);
    expect((await request.get('/work/constructor/')).status()).toBe(404);
  });
});

test.describe('before and after', () => {
  test('renders comparisons with a keyboard-operable slider, or an empty state', async ({ page }) => {
    const errors = collectErrors(page);
    const response = await page.goto(BEFORE_AND_AFTER);
    expect(response?.status()).toBe(200);
    await expectPageBasics(page, /^https:\/\/[^/]+\/before-and-after\/$/);
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).locator('[aria-current="page"]'),
    ).toBeAttached();

    const slider = page.locator('main input[type="range"]').first();
    if ((await slider.count()) === 0) {
      await expect(page.locator('main .border-dashed')).toBeAttached();
      await expect(page.locator('main .border-dashed a[href="/work/"]')).toBeAttached();
      expect(errors).toEqual([]);
      return;
    }

    await expect(page.locator('main table caption').first()).toBeAttached();
    await tabTo(page, (element) => element.tag === 'input' && element.type === 'range');
    await expect(slider).toBeFocused();
    const before = Number(await slider.inputValue());
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue(String(before + 1));
    expect(errors).toEqual([]);
  });
});

test('sitemap.xml lists the work pages', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  expect(xml).toMatch(/<loc>https:\/\/[^<]+\/work\/<\/loc>/);
  expect(xml).toMatch(/<loc>https:\/\/[^<]+\/before-and-after\/<\/loc>/);
});
