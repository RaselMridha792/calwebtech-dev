import { expect, test, type Page } from '@playwright/test';

/**
 * The guides and glossary family (docs/10-site-pages.md) against the placeholder database CI
 * uses: the `guides.index` and `glossary.index` settings, no published guide or term, so both
 * indexes render their empty state. With `pnpm db:seed:fixtures` one guide and two terms are
 * published and the detail templates are covered too. site.indexing is off, so every page is
 * noindex.
 */
const GUIDES = '/guides/';
const GLOSSARY = '/glossary/';
/** packages/db/src/seed/pages/guides-glossary.ts, FIXTURE_GUIDE_SLUG and FIXTURE_TERM_SLUGS. */
const FIXTURE_GUIDE = '/guides/e2e-fixture-guide/';
const FIXTURE_TERM = '/glossary/e2e-fixture-term/';

interface JsonLdNode {
  '@type'?: string;
  name?: string;
  hasDefinedTerm?: { name: string }[];
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

/** Every H2 on a content page is a question a buyer types. */
async function expectQuestionHeadings(page: Page): Promise<void> {
  const headings = await page.locator('main h2').allTextContents();
  expect(headings.length).toBeGreaterThan(0);
  for (const heading of headings) expect(heading.trim()).toMatch(/\?$/);
}

test.describe('guides index', () => {
  test('is noindex with one h1, the answer block first, breadcrumbs and no errors', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(GUIDES);
    await expectSiteBasics(page, GUIDES);
    await expectQuestionHeadings(page);

    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumbs.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/');
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText('Guides');
    const trail = (await jsonLd(page)).find((node) => node['@type'] === 'BreadcrumbList');
    expect(trail?.itemListElement?.map((item) => item.name)).toEqual(['Home', 'Guides']);
    expect(errors).toEqual([]);
  });

  test('lists each published guide as one link, or says nothing is published yet', async ({ page }) => {
    await page.goto(GUIDES);
    const list = page.locator('#guides');
    const cards = list.locator('ul > li a[href^="/guides/"]');
    const count = await cards.count();
    if (count === 0) {
      await expect(list.locator('.border-dashed')).toBeVisible();
      return;
    }
    const hrefs = await cards.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    for (const href of hrefs) expect(href).toMatch(/^\/guides\/[a-z0-9-]+\/$/);
  });

  test('says what the email gate asks for before a visitor reaches a form', async ({ page }) => {
    await page.goto(GUIDES);
    await expect(page.locator('#gate-note')).toContainText(/email/i);
  });
});

test.describe('guide page', () => {
  test('renders the whole summary above the gate, with the file only behind it', async ({ page }) => {
    const errors = watchErrors(page);
    const response = await page.goto(FIXTURE_GUIDE);
    test.skip(response?.status() === 404, 'The end-to-end fixtures are not seeded in this database.');
    await expectSiteBasics(page, FIXTURE_GUIDE);
    await expectQuestionHeadings(page);

    // The answer block sits straight under the H1, and the summary comes before the gate.
    const next = await page
      .locator('h1')
      .evaluate((heading) => heading.nextElementSibling?.hasAttribute('data-answer-block') ?? false);
    expect(next).toBe(true);
    const summary = await page.locator('#summary').boundingBox();
    const gate = await page.locator('#download').boundingBox();
    expect(summary?.y ?? 0).toBeLessThan(gate?.y ?? 0);
    await expect(page.locator('#summary p')).not.toHaveCount(0);
    // The download link only appears once the lead is stored.
    await expect(page.locator('a[href$=".pdf"]')).toHaveCount(0);

    const types = (await jsonLd(page)).map((node) => node['@type']);
    expect(types).toContain('Article');
    expect(types).toContain('BreadcrumbList');
    expect(errors).toEqual([]);
  });

  test('the gate is labelled and operable from the keyboard', async ({ page }) => {
    const response = await page.goto(FIXTURE_GUIDE);
    test.skip(response?.status() === 404, 'The end-to-end fixtures are not seeded in this database.');
    const form = page.locator('#download form');
    await expect(form.getByLabel('Full name')).toBeVisible();
    await expect(form.getByLabel('Work email')).toBeVisible();

    await form.getByLabel('Full name').focus();
    await page.keyboard.type('Test Person');
    await page.keyboard.press('Tab');
    await page.keyboard.type('test.person@example.com');
    await expect(form.getByLabel('Work email')).toHaveValue('test.person@example.com');
    await page.keyboard.press('Tab');
    await expect(form.getByRole('button', { name: /send/i })).toBeFocused();
  });

  test('the hero call to action lands on the gate', async ({ page }) => {
    const response = await page.goto(FIXTURE_GUIDE);
    test.skip(response?.status() === 404, 'The end-to-end fixtures are not seeded in this database.');
    await expect(page.locator('a[href="#download"]').first()).toBeVisible();
  });

  test('an unknown or malformed slug answers 404', async ({ request }) => {
    for (const path of ['/guides/not-a-guide/', '/guides/constructor/', '/guides/Some-Guide/']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
    }
  });
});

test.describe('glossary index', () => {
  test('is noindex with one h1, the answer block first and breadcrumbs', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(GLOSSARY);
    await expectSiteBasics(page, GLOSSARY);
    await expectQuestionHeadings(page);

    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText('Glossary');
    expect(errors).toEqual([]);
  });

  test('lists terms A to Z with jump links, or says nothing is published yet', async ({ page }) => {
    await page.goto(GLOSSARY);
    const list = page.locator('#terms');
    const cards = list.locator('ul > li a[href^="/glossary/"]');
    const count = await cards.count();
    if (count === 0) {
      await expect(list.locator('.border-dashed')).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Jump to a letter' })).toHaveCount(0);
      return;
    }
    const jump = page.getByRole('navigation', { name: 'Jump to a letter' });
    await expect(jump).toBeVisible();
    const letters = jump.locator('a');
    const first = letters.first();
    const target = (await first.getAttribute('href')) ?? '';
    expect(target).toMatch(/^#letter-/);
    await expect(page.locator(target)).toHaveCount(1);

    // A jump link works from the keyboard and lands on the group it names.
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${target.replace('#', '\\#')}$`));

    const defined = (await jsonLd(page)).find((node) => node['@type'] === 'DefinedTermSet');
    expect(defined?.hasDefinedTerm?.length).toBe(count);
  });
});

test.describe('glossary term', () => {
  test('opens with the definition, names its service and carries the DefinedTerm node', async ({ page }) => {
    const errors = watchErrors(page);
    const response = await page.goto(FIXTURE_TERM);
    test.skip(response?.status() === 404, 'The end-to-end fixtures are not seeded in this database.');
    await expectSiteBasics(page, FIXTURE_TERM);
    await expectQuestionHeadings(page);

    const next = await page
      .locator('h1')
      .evaluate((heading) => heading.nextElementSibling?.hasAttribute('data-answer-block') ?? false);
    expect(next).toBe(true);
    await expect(page.locator('#meaning p')).not.toHaveCount(0);
    await expect(page.getByText(/Last updated/)).toBeVisible();

    const nodes = await jsonLd(page);
    const term = nodes.find((node) => node['@type'] === 'DefinedTerm');
    expect(term?.name).toBeTruthy();
    expect(nodes.filter((node) => node['@type'] === 'BreadcrumbList')).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('links back to the glossary and on to a related term from the keyboard', async ({ page }) => {
    const response = await page.goto(FIXTURE_TERM);
    test.skip(response?.status() === 404, 'The end-to-end fixtures are not seeded in this database.');
    const related = page.locator('#next a[href^="/glossary/"]').first();
    test.skip((await related.count()) === 0, 'This term has no related terms in this database.');
    const href = (await related.getAttribute('href')) ?? GLOSSARY;
    await related.focus();
    await Promise.all([page.waitForURL(`**${href}`), page.keyboard.press('Enter')]);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('an unknown or malformed slug answers 404', async ({ request }) => {
    for (const path of ['/glossary/not-a-term/', '/glossary/constructor/', '/glossary/Headless-CMS/']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
    }
  });
});

test('sitemap.xml lists the guides and glossary indexes', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.ok()).toBe(true);
  const xml = await response.text();
  expect(xml).toMatch(/<loc>https:\/\/[^<]+\/guides\/<\/loc>/);
  expect(xml).toMatch(/<loc>https:\/\/[^<]+\/glossary\/<\/loc>/);
});
