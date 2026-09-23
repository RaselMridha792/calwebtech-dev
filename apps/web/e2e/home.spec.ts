import { expect, test } from '@playwright/test';

const PAGE = '/';

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

  test('the mega menus open from the keyboard, dismiss with Escape and close when focus leaves', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'The mega menus are desktop only; small screens use the menu disclosure.');
    await page.goto(PAGE);
    const nav = page.getByRole('navigation', { name: 'Main', exact: true });

    // Where the family has an index page the label is a link to it and the chevron beside
    // it is the panel's control; Resources has no index page, so its label is the control.
    for (const [id, name, indexPath] of [
      ['services', 'Services', '/services/'],
      ['industries', 'Industries', '/industries/'],
      ['work', 'Work', '/work/'],
      ['resources', 'Resources', null],
    ] as const) {
      if (indexPath) {
        await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', indexPath);
      }
      const button = nav.getByRole('button', { name: indexPath ? `${name} menu` : name, exact: true });
      const panel = page.locator(`#menu-${id}`);
      const firstLink = panel.getByRole('link').first();
      await expect(panel, `${name} starts closed`).toBeHidden();
      await expect(button).toHaveAttribute('aria-expanded', 'false');

      await button.focus();
      await expect(panel, `${name} opens while its button has focus`).toBeVisible();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Tab');
      await expect(firstLink, `Tab moves into the ${name} panel`).toBeFocused();
      // The chrome renders on every page, so its links are pages or homepage sections, never bare anchors.
      await expect(firstLink, `${name} links work from any page`).toHaveAttribute('href', /^\//);

      // Escape dismisses the panel without moving focus out of the menu (WCAG 1.4.13).
      await page.keyboard.press('Escape');
      await expect(panel, `Escape dismisses ${name}`).toBeHidden();
      await expect(button).toBeFocused();
      await expect(button).toHaveAttribute('aria-expanded', 'false');

      await page.keyboard.press('Enter');
      await expect(panel, `the ${name} button reopens its panel`).toBeVisible();
      await expect(button).toHaveAttribute('aria-expanded', 'true');

      // Moving focus out of the menu closes it. Where the label is a link, Shift+Tab from
      // the chevron lands on the label, which is still inside the menu and keeps it open —
      // so it takes one more press to leave.
      await page.keyboard.press('Shift+Tab');
      if (indexPath) {
        await expect(panel, `${name} stays open while focus is on its label`).toBeVisible();
        await page.keyboard.press('Shift+Tab');
      }
      await expect(panel, `${name} closes when focus leaves it`).toBeHidden();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
    }
  });

  test('a mega menu closes after a link to a section of this page is followed', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'The mega menus are desktop only; small screens use the menu disclosure.');
    await page.goto(PAGE);
    // The resources menu now reaches real pages, so the same-page link left in a mega menu
    // is the services promotion; it is what proves the panel closes on an in-page jump.
    const button = page
      .getByRole('navigation', { name: 'Main', exact: true })
      .getByRole('button', { name: 'Services menu', exact: true });
    const panel = page.locator('#menu-services');
    const estimate = panel.getByRole('link', { name: 'Get an instant estimate', exact: true });

    // A closed panel is hidden from the accessibility tree, so open it before finding the link.
    await button.focus();
    await expect(panel).toBeVisible();
    await expect(estimate).toHaveAttribute('href', '/#estimate');
    await estimate.focus();
    // Following it moves focus out of the menu (AnchorScroll), which closes it.
    await page.keyboard.press('Enter');
    await expect(panel).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(page).toHaveURL(/\/#estimate$/);
  });

  test('the small-screen menu closes when a link to a section of this page is followed', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'The menu disclosure is for small screens; desktop uses the mega menus.');
    await page.goto(PAGE);
    const menu = page.locator('header details');

    await menu.getByLabel('Menu', { exact: true }).click();
    await expect(menu).toHaveAttribute('open', '');

    await expect(menu.getByRole('link', { name: 'Pricing', exact: true })).toHaveAttribute('href', '/pricing/');
    await expect(menu.getByRole('link', { name: 'Cost calculator', exact: true })).toHaveAttribute(
      'href',
      '/cost-calculator/',
    );
    // The menu's own links are all pages now; the secondary call to action is the same-page
    // jump that proves the disclosure closes when one is followed. The homepage passes its own
    // header copy to SiteHeader rather than the chrome's, so this href is the bare anchor.
    const estimate = menu.getByRole('link', { name: 'Instant estimate', exact: true });
    await expect(estimate).toHaveAttribute('href', '#estimate');
    await estimate.click();
    await expect(menu).not.toHaveAttribute('open', '');
    await expect(page).toHaveURL(/\/#estimate$/);
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
