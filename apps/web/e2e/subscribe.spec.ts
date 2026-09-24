import { expect, test, type Page } from '@playwright/test';

/**
 * "Subscribe now" on the homepage: one field, an address, and a subscriber in the database.
 *
 * It runs against a real API and database, because what the band promises is a row, and the
 * page and the API agreeing about that is the only way to know it holds. The API allows five
 * subscriptions a minute per address, so the tests that submit run once, on the desktop
 * project, and share their budget.
 */
const band = (page: Page) => page.locator('#subscribe');
const address = () => `subscribe.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 7)}@example.com`;

test.describe('subscribe now', () => {
  test('is a band above the footer with one field and no name', async ({ page }) => {
    await page.goto('/');
    const section = band(page);
    await expect(section.getByRole('heading', { name: 'Subscribe now' })).toBeVisible();
    await expect(section.getByLabel('Email address')).toBeVisible();
    // An address, a button, and nothing else asked of the visitor.
    await expect(section.locator('input:not([type="hidden"]):not([tabindex="-1"])')).toHaveCount(1);
    await expect(section.getByRole('button', { name: 'Subscribe' })).toBeVisible();
    await expect(section.getByText(/unsubscribe at any time/i)).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);
  });

  test('says so, in words, when what was typed is not an address', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'Shares the API rate limit with the subscribing test.');
    await page.goto('/');
    const section = band(page);
    await section.getByLabel('Email address').fill('not-an-address');
    await section.getByRole('button', { name: 'Subscribe' }).click();

    // The form waits for the security check before it submits, as every form on the site does,
    // so this allows the same time the other form tests do.
    await expect(section.getByRole('alert')).toContainText(/valid email address/i, { timeout: 20_000 });
    // What was typed is put back, not thrown away.
    await expect(section.getByLabel('Email address')).toHaveValue('not-an-address');
  });

  test('takes an address and confirms it, and a second submission of it is just as welcome', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'The API allows five subscriptions a minute per address.');
    const email = address();
    await page.goto('/');
    const section = band(page);
    await section.getByLabel('Email address').fill(email);
    await section.getByRole('button', { name: 'Subscribe' }).click();

    await expect(section.getByRole('status')).toContainText(/you are on the list/i, { timeout: 20_000 });
    // The form goes, so it cannot be submitted twice by a double click.
    await expect(section.getByLabel('Email address')).toHaveCount(0);

    // The same address again: the same answer, and no error to learn from.
    await page.reload();
    await band(page).getByLabel('Email address').fill(email);
    await band(page).getByRole('button', { name: 'Subscribe' }).click();
    await expect(band(page).getByRole('status')).toContainText(/you are on the list/i, { timeout: 20_000 });
  });
});
