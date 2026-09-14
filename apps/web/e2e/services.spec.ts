import { expect, test, type Page } from '@playwright/test';

/**
 * The services family (docs/10-site-pages.md) against the placeholder database: `/services/`
 * lists the placeholder services grouped by category, or its empty state, and each listed
 * service renders from its columns with the template's headings. Site pages stay noindex
 * while site.indexing is off.
 */
const INDEX = '/services/';

interface JsonLdNode {
  '@type'?: string;
  name?: string;
  url?: string;
  provider?: { '@id'?: string };
  itemListElement?: { position: number; name: string; item: string }[];
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function jsonLd(page: Page): Promise<JsonLdNode[]> {
  const texts = await page.locator('script[type="application/ld+json"]').allTextContents();
  return texts.map((text) => JSON.parse(text) as JsonLdNode);
}

/** The first service the index links to, or null when nothing is published. */
async function firstServicePath(page: Page): Promise<string | null> {
  await page.goto(INDEX);
  const links = await page
    .locator('main a[href^="/services/"]')
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''));
  return links.find((href) => /^\/services\/[a-z0-9-]+\/$/.test(href)) ?? null;
}

test.describe('services index', () => {
  test('is noindex, has one h1 with the answer block under it, breadcrumbs, and fits the viewport', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(INDEX);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/[^/]+\/services\/$/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main [data-answer-block]')).toHaveCount(1);

    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumbs.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/');
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText('Services');

    expect(await horizontalOverflow(page), 'no horizontal overflow').toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test('lists each published service under its category, or says that none is published', async ({ page }) => {
    await page.goto(INDEX);
    const cards = page.locator('main section[id^="services-"] li a[href^="/services/"]');
    const count = await cards.count();
    if (count === 0) {
      await expect(page.locator('main section#services')).toBeVisible();
      return;
    }
    const groups = page.locator('main section[id^="services-"]');
    expect(await groups.count()).toBeGreaterThan(0);
    // Section headings on a content page are the questions buyers type.
    for (const heading of await page.locator('main h2').allTextContents()) expect(heading.trim()).toMatch(/\S\?$/);
    // A card is one target named by its title.
    await expect(cards.first()).toHaveAccessibleName(/\S/);
  });

  test('lists the service pages in sitemap.xml', async ({ request, page }) => {
    const path = await firstServicePath(page);
    const xml = await (await request.get('/sitemap.xml')).text();
    expect(xml).toMatch(/<loc>https:\/\/[^<]+\/services\/<\/loc>/);
    if (path) expect(xml).toContain(`${path}</loc>`);
  });
});

test.describe('service page', () => {
  test('is noindex, opens with the answer block before any call to action, and fits the viewport', async ({ page }) => {
    const path = await firstServicePath(page);
    test.skip(path === null, 'No service is published in this database.');
    const errors = collectErrors(page);
    await page.goto(path ?? INDEX);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${path ?? ''}$`));
    await expect(page.locator('h1')).toHaveCount(1);

    const order = await page.evaluate(() => {
      const answer = document.querySelector('main [data-answer-block]');
      const cta = document.querySelector('main a[href="#enquire"]');
      if (!answer || !cta) return null;
      return Boolean(answer.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order, 'the answer block comes before the first call to action').toBe(true);

    const title = (await page.locator('h1').textContent()) ?? '';
    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumbs.getByRole('link', { name: 'Services', exact: true })).toHaveAttribute('href', INDEX);
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText(title);

    for (const heading of await page.locator('main h2').allTextContents()) {
      expect(heading.trim(), 'section headings on a content page are questions').toMatch(/\?$/);
    }

    expect(await horizontalOverflow(page), 'no horizontal overflow').toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test('has Service and BreadcrumbList structured data', async ({ page }) => {
    const path = await firstServicePath(page);
    test.skip(path === null, 'No service is published in this database.');
    await page.goto(path ?? INDEX);
    const nodes = await jsonLd(page);
    const service = nodes.find((node) => node['@type'] === 'Service');
    expect(service?.name).toBe(((await page.locator('h1').textContent()) ?? '').trim());
    expect(service?.url).toMatch(new RegExp(`${path ?? ''}$`));
    expect(service?.provider?.['@id']).toMatch(/#organization$/);
    const trail = nodes.find((node) => node['@type'] === 'BreadcrumbList');
    expect(trail?.itemListElement?.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(nodes.filter((node) => node['@type'] === 'FAQPage').length).toBeLessThanOrEqual(1);
  });

  test('the primary call to action reaches the enquiry form from the keyboard, and the form describes errors', async ({ page }) => {
    const path = await firstServicePath(page);
    test.skip(path === null, 'No service is published in this database.');
    await page.goto(path ?? INDEX);

    const cta = page.locator('main a[href="#enquire"]').first();
    await cta.focus();
    await page.keyboard.press('Enter');
    const section = page.locator('section#enquire');
    await expect(section).toBeInViewport({ timeout: 10_000 });

    const form = section.locator('form');
    await expect(form.locator('input[type="hidden"][name="type"]')).toHaveValue('SERVICE_ENQUIRY');
    await expect(form.locator('input[type="hidden"][name="serviceSlug"]')).toHaveValue(
      (path ?? '').replace(/^\/services\//, '').replace(/\/$/, ''),
    );

    // Submitting empty stops at validation in the server action, so no lead is stored and the
    // API's per-address limit is untouched. The first submit waits for a Turnstile token.
    await form.getByRole('button').last().click();
    await expect(section.locator('[role="alert"]')).toBeVisible({ timeout: 20_000 });
    const email = form.getByLabel('Work email');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveAttribute('aria-describedby', 'service-enquiry-email-error');
    await expect(form.getByLabel('Full name')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(form.getByLabel('Company', { exact: true })).toBeFocused();
  });

  test('on the placeholder database, shows no price or figure it cannot back up', async ({ page }) => {
    const path = await firstServicePath(page);
    test.skip(path === null, 'No service is published in this database.');
    await page.goto(path ?? INDEX);
    // textContent, not innerText: sections off screen use content-visibility and have no rendered text.
    const text = await page.locator('main').evaluate((main) => {
      const copy = main.cloneNode(true) as Element;
      // Budget ranges in the enquiry form are choices a visitor makes, not claims.
      copy.querySelectorAll('select, script, style, template').forEach((element) => {
        element.remove();
      });
      return copy.textContent;
    });
    expect(text).not.toMatch(/\d\s?%/);
    expect(text).not.toMatch(/\$\s?\d/);
  });
});

test.describe('unknown services', () => {
  for (const path of ['/services/no-such-service/', '/services/constructor/', '/services/__proto__/', '/services/Not-A-Slug/']) {
    test(`${path} answers 404`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(404);
    });
  }
});
