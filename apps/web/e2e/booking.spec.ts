import { expect, test } from '@playwright/test';

const PAGE = '/book-a-consultation/';

/**
 * Booking a consultation, at the address the header, the homepage band and the cost
 * calculator's result all point at (task 5.1).
 *
 * The test books a real slot against a real database, which is the only way to know the
 * page and the engine agree about what is free: a slot rendered from one list and posted
 * against another is the failure this page exists to avoid.
 */
test.describe('book a consultation', () => {
  test('is a page of its own, titled, with times to choose from', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(PAGE);

    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText(/book a consultation/i);

    // Either there are times, or the page says plainly that there are none.
    const times = page.getByRole('button', { pressed: false }).filter({ hasText: /^\d{1,2}[:.]\d{2}/ });
    const empty = page.getByText(/nothing bookable|not available right now/i);
    await expect(times.first().or(empty.first())).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test('takes a booking through its three steps and confirms it', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-1440',
      'The API allows five bookings a minute per address, and a booking takes a slot from the other runs.',
    );
    await page.goto(PAGE);

    const firstTime = page.locator('button[aria-pressed]').first();
    const hasTimes = await firstTime.isVisible().catch(() => false);
    test.skip(!hasTimes, 'No slot is bookable in this environment, so there is nothing to book.');

    // Step one: a time. Choosing it moves to the details.
    await firstTime.click();
    await expect(page.getByRole('heading', { name: /how do we reach you/i })).toBeVisible();

    await page.getByLabel('Full name').fill('E2E Booking');
    await page.getByLabel('Work email').fill(`booking.${testInfo.project.name}@example.com`);
    await page.getByLabel(/what would you like to talk about/i).fill('Our enquiries go missing between the form and the inbox.');
    await page.getByRole('button', { name: 'Review' }).click();

    // Step three shows the time back before anything is sent.
    await expect(page.getByRole('heading', { name: /does this look right/i })).toBeVisible();
    await page.getByRole('button', { name: /confirm this time/i }).click();

    // The confirmation replaces the form: leaving it up invites a second booking of a
    // slot that has already gone.
    await expect(page.getByRole('status')).toContainText(/that time is yours/i, { timeout: 20_000 });
    await expect(page.getByRole('button', { name: /confirm this time/i })).toHaveCount(0);
  });

  test('is listed in sitemap.xml and on the sitemap page', async ({ request, page }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    expect(xml).toContain(`${PAGE}</loc>`);

    await page.goto('/sitemap/');
    const listed = page.getByRole('main').getByRole('link', { name: 'Book a consultation', exact: true });
    await expect(listed.first()).toHaveAttribute('href', PAGE);
  });

  test('is reachable from the header and the homepage band', async ({ page }, testInfo) => {
    await page.goto('/');
    const banner = page.getByRole('banner');
    // At 360px the header's actions live inside the menu disclosure.
    if (testInfo.project.name === 'mobile-360') {
      await banner.locator('details').getByLabel('Menu', { exact: true }).click();
    }
    await expect(banner.getByRole('link', { name: /book a consultation/i }).first()).toHaveAttribute('href', PAGE);

    // The band's own label is editable content, so this asks about the destination.
    await expect(page.locator(`#book a[href="${PAGE}"]`).first()).toBeVisible();
  });
});
