import { expect, test, type Page } from '@playwright/test';

/**
 * The insights family (docs/10-site-pages.md) against the placeholder database CI uses: the
 * placeholder `insights.copy` setting and no `Post` records, because every published article
 * shows in the homepage's insights section, which home.spec.ts requires to be empty. So the
 * index renders its empty state here and every article URL answers 404.
 *
 * The insights fixture (packages/db/src/seed/pages/insights.ts) adds one empty `PostCategory`,
 * so the topic template is exercised with nothing published in it.
 *
 * The article tests run wherever an article is published, such as the snapshot demo. Where it
 * is not, which today includes CI, they are skipped with a "coverage gap" annotation, so the
 * report shows the article template went unchecked rather than passing quietly. Closing the
 * gap needs a published Post fixture that the homepage's insights section tolerates.
 *
 * site.indexing is off, so every page is noindex.
 */
const INDEX = '/insights/';
/** The fixture topic; a topic owns `/insights/<slug>/` before any article of the same name. */
const TOPIC = '/insights/e2e-fixture-topic/';
/** An article in the approved homepage content, and a snapshot page on the demo. */
const ARTICLE = '/insights/website-redesign-cost-2026/';

interface JsonLdNode {
  '@type'?: string;
  itemListElement?: { position: number; name: string; item: string }[];
  author?: { '@type'?: string; name?: string };
  wordCount?: number;
  datePublished?: string;
  dateModified?: string;
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

async function expectSiteBasics(page: Page, path: string): Promise<void> {
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    new RegExp(`^https?://[^/]+${path.replaceAll('/', '\\/')}$`),
  );
  await expect(page.locator('h1')).toHaveCount(1);

  const levels = await page.locator('main h1, main h2, main h3, main h4').evaluateAll((headings) =>
    headings.map((heading) => Number(heading.tagName.slice(1))),
  );
  expect(levels[0], 'the page opens with its H1').toBe(1);
  levels.forEach((level, position) => {
    if (position > 0) expect(level, levels.join(',')).toBeLessThanOrEqual((levels[position - 1] ?? 1) + 1);
  });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);
}

/** The listing's own heading is a question; an article's body headings are checked separately. */
async function expectListingHeading(page: Page): Promise<void> {
  const heading = await page.locator('#insights-list-heading').textContent();
  expect(heading?.trim(), heading ?? '').toMatch(/\?$/);
}

/** True when the listing shows cards rather than its empty state. */
async function articleCards(page: Page): Promise<number> {
  return page.locator('#insights-list a[href^="/insights/"]:not([href$="/insights/"])').count();
}

test.describe('insights index', () => {
  test('is noindex with one h1, breadcrumbs, a question heading and no errors', async ({ page }) => {
    const errors = watchErrors(page);
    const response = await page.goto(INDEX);
    expect(response?.status()).toBe(200);
    await expectSiteBasics(page, INDEX);
    await expectListingHeading(page);

    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumbs.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/');
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText('Insights');
    const trail = (await jsonLd(page)).find((node) => node['@type'] === 'BreadcrumbList');
    expect(trail?.itemListElement?.map((item) => item.name)).toEqual(['Home', 'Insights']);
    expect(errors).toEqual([]);
  });

  test('lists published articles, or says nothing is published yet', async ({ page }) => {
    await page.goto(INDEX);
    const cards = await articleCards(page);
    const empty = page.locator('#insights-list .border-dashed');
    if (cards === 0) {
      await expect(empty).toBeVisible();
      await expect(empty).not.toBeEmpty();
      await expect(empty.getByRole('link')).toHaveAttribute('href', /^\//);
      return;
    }
    await expect(empty).toHaveCount(0);
    const hrefs = await page
      .locator('#insights-list a[href^="/insights/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    for (const href of hrefs) expect(href, href).toMatch(/^\/insights\/([a-z0-9-]+\/)?(\?page=\d+)?$/);
  });

  test('writes the page into the URL, and refuses a page that is not a number', async ({ page, request }) => {
    await page.goto(INDEX);
    const pages = page.getByRole('navigation', { name: /pages/i }).locator('a');
    if ((await pages.count()) > 0) {
      // Every page of the listing is addressable, and the first page is the bare path.
      const hrefs = await pages.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
      for (const href of hrefs) expect(href, href).toMatch(/^\/insights\/(\?page=\d+)?$/);
      expect(hrefs, 'page one is the bare path').not.toContain('/insights/?page=1');
    }
    // A page past the end, and anything that is not a page number, is a 404 rather than an empty list.
    expect((await request.get('/insights/?page=999')).status()).toBe(404);
    expect((await request.get('/insights/?page=two')).status()).toBe(404);
  });

  test('offers a topic filter whose links are pages of their own', async ({ page }) => {
    await page.goto(INDEX);
    const filter = page.getByRole('navigation', { name: 'Topics', exact: true });
    if ((await filter.count()) === 0) {
      test.info().annotations.push({
        type: 'coverage gap',
        description: 'No topic has a published article in this database, so the index topic filter was not checked here.',
      });
      return;
    }
    const hrefs = await filter.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    expect(hrefs[0], 'the first pill clears the filter').toBe(INDEX);
    for (const href of hrefs) expect(href, href).toMatch(/^\/insights\/([a-z0-9-]+\/)?$/);
    await expect(filter.locator('[aria-current="page"]')).toHaveCount(1);
  });
});

/** Opens the fixture topic, or reports that this database has none rather than passing quietly. */
async function openTopic(page: Page): Promise<void> {
  const response = await page.goto(TOPIC);
  const missing = response?.status() === 404;
  if (missing) {
    test.info().annotations.push({
      type: 'coverage gap',
      description: `${TOPIC} does not exist in this database, so the topic template was not checked here.`,
    });
  }
  test.skip(missing, 'The insights fixture topic is not in this database.');
}

test.describe('topic page', () => {
  test('is a page of its own, noindex while it has nothing in it, with the topic in the breadcrumbs', async ({ page }) => {
    const errors = watchErrors(page);
    await openTopic(page);
    await expectSiteBasics(page, TOPIC);
    await expectListingHeading(page);

    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumbs.getByRole('link', { name: 'Insights', exact: true })).toHaveAttribute('href', INDEX);
    const trail = (await jsonLd(page)).find((node) => node['@type'] === 'BreadcrumbList');
    expect(trail?.itemListElement?.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(trail?.itemListElement?.[2]?.item).toMatch(/\/insights\/e2e-fixture-topic\/$/);

    // A topic with nothing published in it is a page with nothing to read.
    if ((await articleCards(page)) === 0) {
      await expect(page.locator('#insights-list .border-dashed')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('marks itself current in the topic filter and links back to every topic', async ({ page }) => {
    await openTopic(page);
    const filter = page.getByRole('navigation', { name: 'Topics', exact: true });
    await expect(filter).toHaveCount(1);
    await expect(filter.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(filter.getByRole('link').first()).toHaveAttribute('href', INDEX);
  });

  test('the topic filter is operable from the keyboard', async ({ page }) => {
    await openTopic(page);
    const all = page.getByRole('navigation', { name: 'Topics', exact: true }).getByRole('link').first();
    await all.focus();
    await expect(all).toBeFocused();
    await Promise.all([page.waitForURL(`**${INDEX}`), page.keyboard.press('Enter')]);
    await expect(page.locator('h1')).toHaveCount(1);
  });
});

/**
 * Opens an article, or reports that none is published here rather than passing quietly.
 *
 * No seed publishes a `Post`: the homepage spec requires the `#insights` section to show its
 * empty state and its body to carry no money amount, and a fixture article would break both
 * (apps/web/e2e/home.spec.ts). The template itself is gated in Vitest instead —
 * `components/insights/insights.test.tsx` renders the real `ArticleBodySection`, its subscribe
 * block and form, and `static-content/insights/insights.test.ts` checks the copy. What only a
 * browser can check, the 360px overflow and the keyboard flow, is what these skips cost, and
 * the family's report asks the foundation for a fixture article.
 */
async function openArticle(page: Page): Promise<void> {
  const response = await page.goto(ARTICLE);
  const missing = response?.status() === 404;
  if (missing) {
    test.info().annotations.push({
      type: 'coverage gap',
      description: `${ARTICLE} is not published in this database, so the article template was not checked here.`,
    });
  }
  test.skip(missing, 'No article is published in this database.');
}

test.describe('article page', () => {
  test('opens with the answer block straight under its only h1, before any call to action', async ({ page }) => {
    const errors = watchErrors(page);
    await openArticle(page);
    await expectSiteBasics(page, ARTICLE);

    const next = await page
      .locator('h1')
      .evaluate((heading) => heading.nextElementSibling?.hasAttribute('data-answer-block') ?? false);
    expect(next, 'the answer block sits straight under the H1').toBe(true);

    const leads = await page.locator('main').evaluate((main) => {
      const answer = main.querySelector('[data-answer-block]');
      if (!answer) return false;
      const links = [...main.querySelectorAll('a')].filter((link) => !link.closest('nav[aria-label="Breadcrumb"]'));
      return links.every((link) => Boolean(answer.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(leads, 'no call to action before the answer block').toBe(true);
    expect(errors).toEqual([]);
  });

  test('carries Article and Person structured data, and a breadcrumb trail through its topic', async ({ page }) => {
    await openArticle(page);
    const nodes = await jsonLd(page);
    const article = nodes.find((node) => node['@type'] === 'Article');
    expect(article, 'an Article node').toBeDefined();
    expect(article?.author?.['@type'], 'the author is a Person').toBe('Person');
    expect(article?.author?.name?.length ?? 0).toBeGreaterThan(0);
    expect(article?.wordCount ?? 0).toBeGreaterThan(1_000);
    expect(article?.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(article?.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const trail = nodes.find((node) => node['@type'] === 'BreadcrumbList');
    expect(trail?.itemListElement?.map((item) => item.position)).toEqual([1, 2, 3, 4]);
    expect(trail?.itemListElement?.at(-1)?.item).toMatch(/\/insights\/website-redesign-cost-2026\/$/);
    expect(nodes.filter((node) => node['@type'] === 'Organization')).toHaveLength(1);
  });

  test('writes every body heading as a question, and anchors each one from the contents', async ({ page }) => {
    await openArticle(page);
    const contents = page.getByRole('navigation', { name: 'On this page', exact: true });
    await expect(contents, 'an article past 1,200 words has a table of contents').toHaveCount(1);

    const anchors = await contents.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    expect(anchors.length).toBeGreaterThan(2);
    for (const anchor of anchors) {
      expect(anchor, anchor).toMatch(/^#[a-z0-9-]+$/);
      await expect(page.locator(anchor), anchor).toHaveCount(1);
    }

    const headings = await page.locator('main h2, main h3').allTextContents();
    const body = headings.filter(
      (heading) => !['Key takeaways', 'On this page', 'About the author'].includes(heading.trim()),
    );
    expect(body.length).toBeGreaterThan(2);
    for (const heading of body) expect(heading.trim(), heading).toMatch(/\?$/);
  });

  test('shows the author, the dates, the reading time and the key takeaways', async ({ page }) => {
    await openArticle(page);
    await expect(page.locator('main time')).not.toHaveCount(0);
    await expect(page.getByText(/\d+ min read/).first()).toBeVisible();
    await expect(page.locator('main img[alt*=","]').first(), 'the author photograph').toBeVisible();
    await expect(page.locator('[aria-labelledby="article-takeaways-label"]')).toHaveCount(1);
    await expect(page.locator('[aria-labelledby="article-author-label"]')).toHaveCount(1);
    await expect(page.locator('[aria-labelledby="article-service-label"] a').first()).toHaveAttribute(
      'href',
      /^\/services\/[a-z0-9-]+\/$/,
    );
  });

  test('the subscribe block is labelled, keyboard operable, and never pretends to have sent', async ({ page }) => {
    await openArticle(page);
    const block = page.locator('[aria-labelledby="article-subscribe-label"]');
    await expect(block).toHaveCount(1);

    const name = block.locator('#insights-subscribe-name');
    const email = block.locator('#insights-subscribe-email');
    await expect(block.locator('label[for="insights-subscribe-name"]')).toHaveCount(1);
    await expect(block.locator('label[for="insights-subscribe-email"]')).toHaveCount(1);

    await name.focus();
    await expect(name).toBeFocused();
    await page.keyboard.type('Jordan Blake');
    await page.keyboard.press('Tab');
    await expect(email).toBeFocused();
    await page.keyboard.type('not-an-email');
    await page.keyboard.press('Tab');
    await expect(block.getByRole('button', { name: /subscribe/i })).toBeFocused();
    await page.keyboard.press('Enter');

    // Either the field error or the "could not send" line, never a success the API did not give.
    const alert = block.locator('[role="alert"], [id$="-error"]').first();
    await expect(alert).toBeVisible();
    await expect(block.locator('[role="status"]')).toHaveCount(0);
  });

  test('links its services, its case study and what to read next', async ({ page }) => {
    await openArticle(page);
    const services = page.locator('#article-services-heading');
    await expect(services).toHaveCount(1);
    expect((await services.textContent())?.trim()).toMatch(/\?$/);

    const related = page.locator('#article-related-heading');
    if ((await related.count()) > 0) {
      expect((await related.textContent())?.trim()).toMatch(/\?$/);
      const hrefs = await page
        .locator('#article-related-heading ~ * a[href^="/insights/"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
      expect(hrefs, 'an article never relates to itself').not.toContain(ARTICLE);
    }
  });
});

test('the index is in sitemap.xml, and an unknown or malformed article answers 404', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  expect(xml).toMatch(new RegExp(`<loc>https?://[^<]+${INDEX}</loc>`));

  for (const path of ['/insights/no-such-article/', '/insights/constructor/', '/insights/Strategy/']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
