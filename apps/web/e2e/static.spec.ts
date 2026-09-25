import { expect, test, type Page } from '@playwright/test';
import { personPause } from './pause';

/**
 * The static family (docs/10-site-pages.md): pricing, process, contact, FAQ, the thank-you
 * pages, the legal set and the designed 404, against the placeholder database, where
 * site.indexing is off and no site-wide questions are published.
 */

const CONTENT_PAGES: [path: string, crumb: string][] = [
  ['/pricing/', 'Pricing'],
  ['/process/', 'How a project runs'],
  ['/faq/', 'Frequently asked questions'],
  ['/contact/', 'Contact'],
];

const LEGAL_PAGES = ['/privacy-policy/', '/terms/', '/cookie-policy/', '/accessibility/', '/information-security/'];

const THANK_YOU_TYPES = ['contact', 'project', 'audit', 'calculator', 'booking', 'resource', 'careers'];

interface JsonLdNode {
  '@type'?: string;
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function jsonLdTypes(page: Page): Promise<string[]> {
  const texts = await page.locator('script[type="application/ld+json"]').allTextContents();
  return texts.map((text) => (JSON.parse(text) as JsonLdNode)['@type'] ?? '');
}

async function expectSitePageBasics(page: Page, path: string): Promise<void> {
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`^https://[^/]+${path.replaceAll('/', '\\/')}$`));
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main#main')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);
}

test.describe('static pages', () => {
  for (const [path, crumb] of [...CONTENT_PAGES, ...LEGAL_PAGES.map((legal): [string, string] => [legal, ''])]) {
    test(`${path} renders one h1, noindex, a canonical, breadcrumbs and no errors`, async ({ page }) => {
      const errors = collectErrors(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expectSitePageBasics(page, path);

      const current = page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).locator('[aria-current="page"]');
      await expect(current).toHaveCount(1);
      if (crumb) await expect(current).toHaveText(crumb);
      expect(await jsonLdTypes(page)).toContain('BreadcrumbList');

      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveText('Skip to content');
      expect(errors).toEqual([]);
    });
  }

  test('pricing and process open with the answer block before any call to action', async ({ page }) => {
    for (const path of ['/pricing/', '/process/']) {
      await page.goto(path);
      const order = await page.locator('main').evaluate((main) => {
        const answer = main.querySelector('[data-answer-block]');
        const hero = main.querySelector('section');
        if (!answer || !hero) return 'missing';
        const breadcrumbs = hero.querySelector('nav[aria-label="Breadcrumb"]');
        const cta = [...hero.querySelectorAll('a')].find((link) => !breadcrumbs?.contains(link));
        if (!cta) return 'answer first';
        return answer.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING ? 'answer first' : 'cta first';
      });
      expect(order, path).toBe('answer first');
    }
  });

  test('pricing shows the published tiers and process every published stage', async ({ page }) => {
    await page.goto('/pricing/');
    await expect(page.locator('#tiers li h3').first()).toBeAttached();
    await page.goto('/process/');
    await expect(page.locator('#stages ol > li h3').first()).toBeAttached();
  });

  test('the FAQ page shows its empty state while no site-wide questions are published', async ({ page }) => {
    await page.goto('/faq/');
    await expect(page.locator('main details')).toHaveCount(0);
    await expect(page.locator('main').getByText(/No questions are published yet/)).toBeVisible();
    expect(await jsonLdTypes(page)).not.toContain('FAQPage');
  });

  test('legal pages list their sections and link to each from the contents', async ({ page }) => {
    for (const path of LEGAL_PAGES) {
      await page.goto(path);
      const contents = page.getByRole('navigation', { name: 'On this page' });
      const links = contents.getByRole('link');
      expect(await links.count(), path).toBeGreaterThan(1);
      const target = await links.first().getAttribute('href');
      expect(target).toMatch(/^#[a-z0-9-]+$/);
      await expect(page.locator(target ?? '')).toBeAttached();
    }
  });
});

test.describe('contact page', () => {
  test('is its own conversion point: the closing band and floating call to action are hidden', async ({ page }) => {
    await page.goto('/contact/');
    await expect(page.locator('[data-conversion-band]')).toBeHidden();
    await expect(page.locator('[data-floating-cta]')).toBeHidden();
    expect(await jsonLdTypes(page)).toContain('ContactPage');
  });

  test('routes enquiries by topic, chosen from the form or from a link', async ({ page }) => {
    await page.goto('/contact/?enquiry=free-website-audit');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/contact\/$/);
    const form = page.locator('#contact-form form');
    const topic = form.getByLabel('What is it about?');
    await expect(topic).toHaveValue('free-website-audit');
    await expect(topic.locator('option')).not.toHaveCount(0);

    await page.goto('/contact/');
    const firstRoute = page.locator('#routing li a').first();
    const href = (await firstRoute.getAttribute('href')) ?? '';
    expect(href).toMatch(/^\/contact\/\?enquiry=[a-z0-9-]+#contact-form$/);
  });

  test('describes field errors, and is operable from the keyboard', async ({ page }) => {
    await page.goto('/contact/');
    const form = page.locator('#contact-form form');
    await form.getByLabel('What is it about?').focus();
    await page.keyboard.press('Tab');
    await expect(form.getByLabel('Full name')).toBeFocused();

    await form.getByRole('button').last().click();
    const invalid = form.locator('[aria-invalid="true"]').first();
    await expect(invalid).toBeVisible({ timeout: 20_000 });
    const describedBy = await invalid.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy ?? ''}`)).not.toBeEmpty();
  });

  test('stores a CONTACT lead with its topic and lands on the thank-you page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'The API allows five leads a minute per address; one project submits.');
    test.setTimeout(150_000);
    await page.goto(`/contact/?enquiry=support&utm_source=e2e&utm_campaign=${testInfo.project.name}`);
    const form = page.locator('#contact-form form');
    await form.getByLabel('Full name').fill('E2E Contact');
    await form.getByLabel('Company', { exact: true }).fill('Example Client');
    await form.getByLabel('Work email').fill(`contact.${testInfo.project.name}@example.com`);
    await form.getByLabel('Phone', { exact: true }).fill('+1 555 010 0100');
    await form.locator('textarea').fill('A question about the care plan on our current site.');

    const submit = form.getByRole('button').last();
    await personPause(page);
    // The first submit waits for a Turnstile token (Cloudflare's always-pass test key).
    await submit.click();
    const landed = page
      .waitForURL(/\/thank-you\/contact\/$/, { timeout: 25_000 })
      .then(() => 'landed')
      .catch(() => 'timeout');
    const alert = form
      .locator('[role="alert"]')
      .waitFor({ timeout: 25_000 })
      .then(() => 'alert')
      .catch(() => 'timeout');
    if ((await Promise.race([landed, alert])) === 'alert') {
      // Other specs in the run may have used this minute's leads: wait out the limit once.
      await expect(form.locator('[role="alert"]')).toContainText(/several requests/i);
      await page.waitForTimeout(61_000);
      await form.getByRole('button').last().click();
      await page.waitForURL(/\/thank-you\/contact\/$/, { timeout: 25_000 });
    }
    await expect(page).toHaveURL(/\/thank-you\/contact\/$/);
    await expect(page.locator('h1')).toHaveCount(1);
  });
});

test.describe('thank-you pages', () => {
  for (const type of THANK_YOU_TYPES) {
    test(`/thank-you/${type}/ confirms the submission, is noindex and hides the closing band`, async ({ page }) => {
      const response = await page.goto(`/thank-you/${type}/`);
      expect(response?.status()).toBe(200);
      await expectSitePageBasics(page, `/thank-you/${type}/`);
      await expect(page.locator('[data-conversion-band]')).toBeHidden();
      await expect(page.locator('main a[href^="tel:"]').first()).toBeVisible();
      await expect(page.locator('main h2')).not.toHaveCount(0);
    });
  }

  test('an unknown type answers 404 inside the site layout, including names Object knows', async ({ page }) => {
    for (const type of ['newsletter', 'constructor', '__proto__']) {
      const response = await page.goto(`/thank-you/${type}/`);
      expect(response?.status(), type).toBe(404);
      await expect(page.locator('header').first()).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
    }
  });
});

test.describe('not-found and sitemap', () => {
  test('a URL that matches no route answers 404 with search and destinations', async ({ page }) => {
    const errors = collectErrors(page);
    const response = await page.goto('/this-page-does-not-exist/');
    expect(response?.status()).toBe(404);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('search').getByRole('searchbox')).toBeVisible();
    await expect(page.locator('section:has(#destinations-heading) li a').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);
    expect(errors.filter((error) => !error.includes('404'))).toEqual([]);
  });

  test('the search finds pages as you type, and Enter moves to the first match', async ({ page }) => {
    await page.goto('/this-page-does-not-exist/');
    const search = page.getByRole('search');
    const box = search.getByRole('searchbox');
    await box.focus();
    await box.pressSequentially('pricing');
    await expect(search.getByRole('link', { name: 'Pricing', exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(search.getByRole('status')).not.toBeEmpty();
    await page.keyboard.press('Enter');
    await expect(search.getByRole('link').first()).toBeFocused();
  });

  test('sitemap.xml lists the family pages and leaves out thank-you pages', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    for (const path of ['/pricing/', '/process/', '/faq/', '/contact/', ...LEGAL_PAGES]) {
      expect(xml).toContain(`${path}</loc>`);
    }
    expect(xml).not.toContain('/thank-you/');
  });
});
