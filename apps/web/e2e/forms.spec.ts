import { expect, test, type Page } from '@playwright/test';

const PAGE = '/start-a-project/';

/**
 * The start a project brief (docs/06-build-plan.md, task 5.2) against a real API and
 * database: six steps, the brief saved as the visitor goes, and the send completing that same
 * lead. The copy comes from the seed, so the tests hold on to structure, not wording.
 */
const brief = (page: Page) => page.locator('#brief');
const next = (page: Page) => brief(page).locator('button[type="submit"]');
const progress = (page: Page) => brief(page).locator('p.meta');
const address = () => `brief.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 7)}@example.com`;

test.describe('start a project', () => {
  test('is one page with one heading, its answer block and the first question only', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(PAGE);

    await expect(page.locator('h1')).toHaveCount(1);
    await expect(brief(page).locator('fieldset[data-step]')).toHaveCount(6);
    await expect(brief(page).locator('fieldset[data-step]:not([hidden])')).toHaveCount(1);
    await expect(progress(page)).toContainText('1');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test('moves by keyboard, and will not pass the contact step without a name and an email', async ({ page }) => {
    await page.goto(PAGE);

    await brief(page).locator('input[name="projectType"]').first().focus();
    await page.keyboard.press('Space');
    await next(page).focus();
    await page.keyboard.press('Enter');
    // The new question takes focus, so a keyboard user lands where the page changed.
    await expect(brief(page).locator('fieldset[data-step="1"] legend')).toBeFocused();

    await next(page).focus();
    await page.keyboard.press('Enter');
    await expect(brief(page).locator('fieldset[data-step="1"]')).toBeVisible();
    await expect(page.locator('#brief-name')).toBeFocused();
  });

  test('saves the brief from the contact step on, and sends it as one lead', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'The API allows five leads a minute per address.');
    await page.goto(PAGE);

    await next(page).click();
    await page.locator('#brief-name').fill('Jordan Blake');
    await page.locator('#brief-email').fill(address());
    await next(page).click();
    // Only a saved brief says it is saved.
    await expect(brief(page).locator('p[aria-live="polite"]').last()).not.toBeEmpty({ timeout: 15_000 });

    for (let step = 2; step < 5; step += 1) await next(page).click();
    await expect(brief(page).locator('fieldset[data-step="5"]')).toBeVisible();
    await page.locator('#brief-message').fill('Our quote form breaks on mobile.');
    await next(page).click();

    // The send waits for the security check, as every form on the site does.
    await page.waitForURL(/\/thank-you\/project\/$/, { timeout: 30_000 });
  });
});
