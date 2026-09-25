import type { Page } from '@playwright/test';

/**
 * Waits as long as a person takes before sending a form. The API refuses a form sent sooner
 * after it appeared than its minimum (FORM_MINIMUM_MS, docs/08-decisions.md, 61) as
 * automated, and a test fills a form faster than anyone could.
 */
export function personPause(page: Page): Promise<void> {
  return page.waitForTimeout(2_200);
}
