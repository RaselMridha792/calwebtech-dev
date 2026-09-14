import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The cost calculator, `/cost-calculator/` (docs/03-page-specs.md, docs/10-site-pages.md),
 * against the placeholder database, where `site.indexing` is off, the copy is the
 * placeholder seed and no price bands or pricing questions are published.
 *
 * Nothing here asserts the words of the page, because the seed's copy is placeholder and
 * the publish-ready copy lives in the snapshot. What is asserted is the behaviour: eight
 * questions, the progress, keyboard operation, the email step, the stored result and the
 * documented events.
 */

/** The DOM event every tracked action dispatches (components/calculator/events.ts). */
const TRACK_EVENT = 'calwebtech:track';
const STEPS = 8;

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

/** Records every measurable event the calculator dispatches, before any script has run. */
async function recordEvents(page: Page): Promise<void> {
  await page.addInitScript((eventName: string) => {
    const tracked: string[] = [];
    Object.defineProperty(window, '__calculatorEvents', { value: tracked });
    window.addEventListener(eventName, (event) => {
      tracked.push((event as CustomEvent<{ name: string }>).detail.name);
    });
  }, TRACK_EVENT);
}

const trackedEvents = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __calculatorEvents: string[] }).__calculatorEvents);

/** The tool, once its chunk has arrived and replaced the server-rendered card. */
async function calculator(page: Page): Promise<Locator> {
  const tool = page.locator('#calculator');
  await tool.scrollIntoViewIfNeeded();
  await expect(tool.locator('input[name="projectType"]').first()).toBeAttached({ timeout: 30_000 });
  return tool;
}

/** Chooses the first answer to the question on screen and moves on. */
async function answerStep(tool: Locator): Promise<void> {
  await tool.locator('form fieldset label').first().click();
  await tool.locator('form button[type="submit"]').click();
}

test.describe('cost calculator page', () => {
  test('is noindex, has one h1 with the answer block before any call to action, and fits the viewport', async ({ page }) => {
    const errors = collectErrors(page);
    const response = await page.goto('/cost-calculator/');
    expect(response?.status()).toBe(200);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/cost-calculator\/$/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main#main')).toBeVisible();
    await expect(page.locator('main [data-answer-block]')).toHaveCount(1);

    // The breadcrumbs sit above the answer block on every template and are not a call to
    // action, so they are excluded here as they are in the other page suites.
    const order = await page.evaluate(() => {
      const answer = document.querySelector('main [data-answer-block]');
      if (!answer) return null;
      const cta = [...document.querySelectorAll('main a[href^="#"], main a[href^="/"]')].find(
        (link) => !link.closest('nav[aria-label="Breadcrumb"]'),
      );
      if (!cta) return null;
      return Boolean(answer.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order, 'the answer block comes before the first call to action').toBe(true);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test('carries breadcrumbs and their BreadcrumbList node', async ({ page }) => {
    await page.goto('/cost-calculator/');
    const current = page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText('Cost calculator');

    const texts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = texts.map((text) => (JSON.parse(text) as JsonLdNode)['@type'] ?? '');
    expect(types).toContain('BreadcrumbList');
  });

  test('renders the first question and the published rates without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      baseURL: 'https://localhost:3443',
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    await page.goto('/cost-calculator/');
    // The server-rendered card is the first question, so there is nothing to shift later.
    await expect(page.locator('#calculator li')).not.toHaveCount(0);
    // The methodology table is the part that ranks, and it never needs the tool to run.
    await expect(page.locator('#methodology table tbody tr').first()).toBeVisible();
    await context.close();
  });

  test('walks the eight questions with the keyboard and dispatches one event each', async ({ page }) => {
    await recordEvents(page);
    await page.goto('/cost-calculator/');
    const tool = await calculator(page);
    const progress = tool.locator('[role="progressbar"]');

    await expect(progress).toHaveAttribute('aria-valuenow', '1');
    // The bar says what is progressing; the visible label beside it is never its name.
    await expect(progress).toHaveAttribute('aria-label', /\S/);
    // A question cannot be skipped: pressing next without an answer describes the problem.
    await tool.locator('form button[type="submit"]').click();
    await expect(tool.locator('form [role="alert"]')).toBeVisible();
    const describedBy = await tool.locator('form fieldset').getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy ?? ''}`)).not.toBeEmpty();

    // Keyboard only: focus the group, choose with the space bar, continue with Enter.
    await tool.locator('form fieldset input').first().focus();
    await page.keyboard.press('Space');
    await expect(tool.locator('form fieldset input').first()).toBeChecked();
    await page.keyboard.press('Enter');
    await expect(progress).toHaveAttribute('aria-valuenow', '2');

    // Back returns the earlier answer, still chosen.
    await tool.getByRole('button').first().click();
    await expect(progress).toHaveAttribute('aria-valuenow', '1');
    await expect(tool.locator('form fieldset input').first()).toBeChecked();
    await tool.locator('form button[type="submit"]').click();

    for (let step = 2; step < STEPS; step += 1) await answerStep(tool);
    await answerStep(tool);

    // The email step is the last card: labelled fields, and no ninth question.
    await expect(tool.getByLabel('Work email')).toBeVisible();
    await expect(progress).toHaveAttribute('aria-valuenow', String(STEPS + 1));

    // Back from the email step and forward again. The bot check lives inside that card, so
    // leaving has to drop it: a widget left behind would hold the next submission open.
    await tool.locator('form button[type="button"]').click();
    await expect(progress).toHaveAttribute('aria-valuenow', String(STEPS));
    await tool.locator('form button[type="submit"]').click();
    await expect(tool.getByLabel('Work email')).toBeVisible();

    const events = await trackedEvents(page);
    expect(events.filter((name) => name.startsWith('calculator-step-'))).toContain('calculator-step-3-page-count');
    expect(new Set(events.filter((name) => name.startsWith('calculator-step-'))).size).toBe(STEPS);
    expect(events).toContain('calculator-email-gate');
  });

  test('stores a CALCULATOR lead and shows the range it computed', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'The API allows five leads a minute per address; one project submits.');
    test.setTimeout(180_000);
    await recordEvents(page);
    await page.goto('/cost-calculator/?utm_source=e2e&utm_campaign=calculator');
    const tool = await calculator(page);
    for (let step = 0; step < STEPS; step += 1) await answerStep(tool);

    const form = tool.locator('form');
    await form.getByLabel('Full name').fill('E2E Estimate');
    await form.getByLabel('Work email').fill('calculator.desktop@example.com');
    await form.getByLabel('Company', { exact: true }).fill('Example Client');
    await form.getByRole('button').last().click();

    const result = tool.locator('[data-calculator-result]');
    const shown = result
      .waitFor({ timeout: 40_000 })
      .then(() => 'result')
      .catch(() => 'timeout');
    const alert = form
      .locator('[role="alert"]')
      .waitFor({ timeout: 40_000 })
      .then(() => 'alert')
      .catch(() => 'timeout');
    if ((await Promise.race([shown, alert])) === 'alert') {
      // Other specs in the run may have used this minute's leads: wait the limit out once.
      await expect(form.locator('[role="alert"]')).toContainText(/several requests/i);
      await page.waitForTimeout(61_000);
      await form.getByRole('button').last().click();
    }

    await expect(result).toBeVisible({ timeout: 40_000 });
    // The range, the breakdown and the answers all come back from the API, never from here.
    await expect(result).toContainText(/\$[\d,]+ to \$[\d,]+/);
    await expect(result.locator('dl').first().locator('> div')).not.toHaveCount(0);

    // The next action carries every answer to the booking page.
    const booking = result.locator('a[href^="/book-a-consultation/"]');
    const href = (await booking.getAttribute('href')) ?? '';
    expect(href).toContain('source=cost-calculator');
    const query = new URLSearchParams(href.split('?')[1] ?? '');
    for (const key of ['project-type', 'timeline', 'page-count', 'design-depth', 'content', 'integrations', 'cms', 'support']) {
      expect(query.get(key), key).toBeTruthy();
    }

    const events = await trackedEvents(page);
    expect(events).toContain('calculator-email-submit');
    // Written as a pattern: the lint rule reads a bare "<word>-result" string as a Tailwind class.
    expect(events.some((name) => /^calculator-result(-unsent)?$/.test(name))).toBe(true);

    // Starting again returns to the first question rather than leaving the result on screen.
    await result.getByRole('button', { name: /again/i }).click();
    await expect(result).toHaveCount(0);
    await expect(tool.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '1');
  });

  test('publishes the rates the range is worked out from', async ({ page }) => {
    await page.goto('/cost-calculator/');
    const table = page.locator('#methodology table');
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr')).not.toHaveCount(0);
    await expect(table.locator('th[scope="colgroup"]')).toHaveCount(6);
    // The table is the only thing on the page allowed to scroll sideways.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
