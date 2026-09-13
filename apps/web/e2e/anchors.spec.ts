import { expect, test, type Page } from '@playwright/test';

/**
 * Below-the-fold sections use content-visibility with an estimated intrinsic size.
 * A wrong estimate lands anchors in the wrong place, so every in-page link and every
 * section id must bring its target to the top of the viewport, offset by its
 * scroll-margin and clear of the sticky header. Links are checked with the smooth
 * glide (components/motion/anchor-scroll.tsx) and with reduced motion, where the
 * browser jumps on its own.
 */

const PAGES = ['/lp/b2b-website-design/'];

/** Resolves once the scroll position has not changed for ten frames. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = Number.NaN;
        let stableFrames = 0;
        const tick = () => {
          stableFrames = window.scrollY === last ? stableFrames + 1 : 0;
          last = window.scrollY;
          if (stableFrames >= 10) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  // content-visibility sections that just rendered can resize; wait for that to finish too.
  await page.waitForTimeout(400);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

interface Placement {
  top: number;
  scrollMarginTop: number;
  headerBottom: number;
  viewportHeight: number;
  atMaxScroll: boolean;
}

async function placementOf(page: Page, id: string): Promise<Placement | null> {
  return page.evaluate((targetId) => {
    const target = document.getElementById(targetId);
    if (!target) return null;
    const header = document.querySelector('header');
    const headerStyle = header ? getComputedStyle(header) : null;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    return {
      top: target.getBoundingClientRect().top,
      scrollMarginTop: Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0,
      headerBottom:
        header && headerStyle && (headerStyle.position === 'sticky' || headerStyle.position === 'fixed')
          ? header.getBoundingClientRect().bottom
          : 0,
      viewportHeight: window.innerHeight,
      atMaxScroll: Math.abs(window.scrollY - maxScroll) < 2,
    };
  }, id);
}

function expectLandedOn(id: string, placement: Placement | null): void {
  expect(placement, `#${id} exists`).not.toBeNull();
  if (!placement) return;
  // Near the bottom of the page the browser cannot scroll far enough; only then may the
  // target sit lower than its scroll-margin.
  if (!placement.atMaxScroll) {
    expect(Math.abs(placement.top - placement.scrollMarginTop), `#${id} lands at its scroll-margin`).toBeLessThanOrEqual(2);
  }
  expect(placement.top, `#${id} is not hidden under the sticky header`).toBeGreaterThanOrEqual(placement.headerBottom - 1);
  expect(placement.top, `#${id} is on screen`).toBeLessThan(placement.viewportHeight);
}

for (const path of PAGES) {
  test.describe(`anchors on ${path}`, () => {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      for (const start of ['top', 'bottom'] as const) {
        test(`every in-page link lands on its section, from the ${start}, motion ${reducedMotion}`, async ({ page }) => {
          await page.emulateMedia({ reducedMotion });
          await page.goto(path);
          const hrefs = await page
            .locator('a[href^="#"]')
            .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href') ?? ''))].filter((h) => h.length > 1));
          expect(hrefs.length, 'the page has in-page links').toBeGreaterThan(0);

          for (const href of hrefs) {
            await page.evaluate((y) => {
              window.history.replaceState(null, '', window.location.pathname);
              window.scrollTo({ top: y, behavior: 'instant' });
            }, start === 'top' ? 0 : Number.MAX_SAFE_INTEGER);
            await settle(page);

            // Click the first link a person could actually see and hit. Visually hidden skip
            // links (a 1px box) and links hidden at this breakpoint navigate by script instead.
            const links = page.locator(`a[href="${href}"]`);
            let clicked = false;
            for (let i = 0; i < (await links.count()); i++) {
              const link = links.nth(i);
              const box = await link.boundingBox();
              if (box && box.width > 4 && box.height > 4 && (await link.isVisible())) {
                await link.click();
                clicked = true;
                break;
              }
            }
            if (!clicked) {
              await links.first().evaluate((link) => {
                (link as HTMLAnchorElement).click();
              });
            }
            await settle(page);
            await expect(page).toHaveURL(new RegExp(`${href}$`));
            expectLandedOn(href.slice(1), await placementOf(page, href.slice(1)));
          }
        });
      }
    }

    test('a cold deep link to every section id lands on it', async ({ page }) => {
      await page.goto(path);
      const ids = await page.locator('main [id]').evaluateAll((elements) =>
        elements.filter((el) => el.tagName === 'SECTION' || el.id === 'form').map((el) => el.id),
      );
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        // From the same page, goto only changes the hash. Leave first so each is a real load.
        await page.goto('about:blank');
        await page.goto(`${path}#${id}`);
        await settle(page);
        expectLandedOn(id, await placementOf(page, id));
      }
    });
  });
}
