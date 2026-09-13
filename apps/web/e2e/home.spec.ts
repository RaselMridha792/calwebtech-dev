import { expect, test } from '@playwright/test';

const PAGE = '/';
const SUBMIT = /book my consultation/i;

/** Sections navigation links to, with the empty-state line the launch seed gives them. */
const EMPTY_STATES: [section: string, text: string][] = [
  ['#work', 'No case studies are published yet.'],
  ['#beforeafter', 'No before and after comparison is published yet.'],
  ['#testimonials', 'No client quotes are published yet.'],
  ['#insights', 'No articles are published yet.'],
  ['#locations', 'No locations are published yet.'],
  ['#awards', 'Nothing is published here yet.'],
];

test.describe('homepage', () => {
  test('is noindex, fits the viewport, starts with a skip link and logs no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(PAGE);

    // Placeholder content stays out of search until homepage.indexing is switched on.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('h1')).toHaveCount(1);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);

    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveText('Skip to content');
    await expect(focused).toHaveAttribute('href', '#main');

    expect(errors).toEqual([]);
  });

  test('the placeholder page shows empty states, not proof it cannot back up', async ({ page }) => {
    await page.goto(PAGE);
    for (const [section, text] of EMPTY_STATES) {
      await expect(page.locator(section).getByText(text, { exact: true }), `${section} shows its empty state`).toBeAttached();
    }

    // textContent, not innerText: sections off screen use content-visibility and have no rendered text.
    const text = await page.locator('main').evaluate((main) => {
      const copy = main.cloneNode(true) as Element;
      // Budget ranges in the consultation form are choices a visitor makes, not claims.
      copy.querySelectorAll('select, script, style, template').forEach((element) => {
        element.remove();
      });
      return copy.textContent;
    });
    expect(text, 'no percentage figures').not.toMatch(/\d\s?%/);
    expect(text, 'no star ratings').not.toContain('★');
    expect(text, 'no money amounts').not.toMatch(/\$\s?\d/);
  });

  test('the consultation form stores a lead', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-1440',
      'The API allows five leads a minute per address, and the landing page tests use most of them.',
    );
    await page.goto(`${PAGE}?utm_source=e2e&utm_campaign=${testInfo.project.name}`);
    const form = page.locator('#book form');
    await form.scrollIntoViewIfNeeded();
    await form.getByLabel('Full name').fill('E2E Consultation');
    await form.getByLabel('Company', { exact: true }).fill('Example Client');
    await form.getByLabel('Work email').fill(`consultation.${testInfo.project.name}@example.com`);
    await form.getByLabel('Phone', { exact: true }).fill('+1 555 010 0100');
    await form.getByText('Redesign', { exact: true }).click();
    await form.getByLabel('Budget range').selectOption('25k-60k');
    await form.getByLabel('How did you find us?').selectOption('AI assistant');
    await form.getByLabel('What is going wrong right now?').fill('The site is slow and enquiries go missing.');

    // The first submit waits for a Turnstile token (Cloudflare's always-pass test key).
    await form.getByRole('button', { name: SUBMIT }).click();
    await expect(page.locator('#book [role="status"]')).toContainText('Thanks', { timeout: 20_000 });
  });

  test('the mega menus open from the keyboard, dismiss with Escape and close after a link is followed', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'The mega menus are desktop only; small screens use the menu disclosure.');
    await page.goto(PAGE);
    const nav = page.getByRole('navigation', { name: 'Main', exact: true });

    for (const [id, name] of [
      ['services', 'Services'],
      ['industries', 'Industries'],
      ['work', 'Work'],
      ['resources', 'Resources'],
    ] as const) {
      const button = nav.getByRole('button', { name, exact: true });
      const panel = page.locator(`#menu-${id}`);
      const firstLink = panel.getByRole('link').first();
      await expect(panel, `${name} starts closed`).toBeHidden();
      await expect(button).toHaveAttribute('aria-expanded', 'false');

      await button.focus();
      await expect(panel, `${name} opens while its button has focus`).toBeVisible();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Tab');
      await expect(firstLink, `Tab moves into the ${name} panel`).toBeFocused();

      // Escape dismisses the panel without moving focus out of the menu (WCAG 1.4.13).
      await page.keyboard.press('Escape');
      await expect(panel, `Escape dismisses ${name}`).toBeHidden();
      await expect(button).toBeFocused();
      await expect(button).toHaveAttribute('aria-expanded', 'false');

      await page.keyboard.press('Enter');
      await expect(panel, `the ${name} button reopens its panel`).toBeVisible();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Tab');
      await expect(firstLink).toBeFocused();

      // Following the link moves focus out of the menu (AnchorScroll), which closes it.
      await page.keyboard.press('Enter');
      await expect(panel, `${name} closes after a link is followed`).toBeHidden();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
    }
  });

  test('the small-screen menu closes when a link is followed', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'The menu disclosure is for small screens; desktop uses the mega menus.');
    await page.goto(PAGE);
    const menu = page.locator('header details');

    await menu.getByLabel('Menu', { exact: true }).click();
    await expect(menu).toHaveAttribute('open', '');

    const pricing = menu.getByRole('link', { name: 'Pricing', exact: true });
    await expect(pricing).toHaveAttribute('href', '#pricing');
    await pricing.click();
    await expect(menu).not.toHaveAttribute('open', '');
    await expect(page).toHaveURL(/#pricing$/);
  });

  test('the recognition tabs switch with the arrow keys', async ({ page }) => {
    await page.goto(PAGE);
    const section = page.locator('#awards');
    // Below the fold the section is skipped by content-visibility until it comes near the viewport.
    await section.scrollIntoViewIfNeeded();

    const awards = section.getByRole('radio', { name: 'Awards', exact: true });
    const expertise = section.getByRole('radio', { name: 'Expertise', exact: true });
    const awardsEmpty = section.getByText('Nothing is published here yet.', { exact: true });
    await expect(awards).toBeChecked();
    await expect(awardsEmpty).toBeVisible();

    await awards.focus();
    await page.keyboard.press('ArrowRight');
    await expect(expertise).toBeChecked();
    await expect(expertise).toBeFocused();
    await expect(section.getByText('Website design', { exact: true })).toBeVisible();
    await expect(awardsEmpty).toBeHidden();
  });
});
