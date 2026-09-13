import { expect, test } from '@playwright/test';

const PAGE = '/lp/b2b-website-design/';

test.describe('campaign landing page', () => {
  test('fits the viewport, starts with a visible skip link and logs no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(PAGE);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);

    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveText('Skip to the form');
    expect(await focused.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');

    expect(errors).toEqual([]);
  });

  test('the skip link moves keyboard focus to the form', async ({ page }) => {
    await page.goto(PAGE);
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveText('Skip to the form');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#form$/);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('#form') != null)).toBe(true);
  });

  test('the hero form describes field errors, then stores a lead', async ({ page }, testInfo) => {
    await page.goto(`${PAGE}?utm_source=e2e&utm_campaign=${testInfo.project.name}`);
    const form = page.locator('#form form');

    await form.getByRole('button', { name: /send me a free proposal/i }).click();
    await expect(page.locator('#form [role="alert"]')).toBeVisible();
    const email = form.getByLabel('Work email');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveAttribute('aria-describedby', 'lp-hero-email-error');
    await expect(form.getByLabel('Full name')).toBeFocused();

    await form.getByLabel('Full name').fill('E2E Hero');
    await email.fill(`hero.${testInfo.project.name}@example.com`);
    await form.getByLabel('Budget range').selectOption('25k-60k');
    await form.getByRole('button', { name: /send me a free proposal/i }).click();
    await expect(page.locator('#form [role="status"]')).toContainText('Thanks', { timeout: 20_000 });
  });

  test('the final form stores a lead with the chosen services', async ({ page }, testInfo) => {
    await page.goto(PAGE);
    const form = page.locator('#final form');
    await form.scrollIntoViewIfNeeded();
    await form.getByLabel('Full name').fill('E2E Final');
    await form.getByLabel('Work email').fill(`final.${testInfo.project.name}@example.com`);
    await form.getByLabel('Current website').fill('example-client.com');
    await form.getByText('Redesign', { exact: true }).click();
    await form.getByLabel('When do you want to start?').selectOption('this-quarter');
    await form.getByRole('button', { name: /send me a free proposal/i }).click();
    await expect(page.locator('#final [role="status"]')).toContainText('Thanks', { timeout: 20_000 });
  });

  test('the stepper, slider and FAQ work from the keyboard', async ({ page }) => {
    await page.goto(PAGE);

    const firstTab = page.getByRole('tab').first();
    await firstTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab').nth(1)).toBeFocused();
    await expect(page.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel').filter({ visible: true })).toHaveCount(1);

    const slider = page.locator('input[type="range"]');
    await slider.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('60');

    const faqs = page.locator('details[name="landing-faq"]');
    await faqs.nth(1).locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(faqs.nth(1)).toHaveAttribute('open', '');
    await expect(faqs.nth(0)).not.toHaveAttribute('open', '');
  });
});
