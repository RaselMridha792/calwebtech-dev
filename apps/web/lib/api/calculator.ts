import 'server-only';
import {
  CALCULATOR_PATH,
  botCheckFailedResponseSchema,
  calculatorLeadReceivedSchema,
  calculatorPageViewSchema,
  validationErrorResponseSchema,
  type CalculatorEstimate,
  type CalculatorPageView,
  type LeadSubmission,
} from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import { calculatorPageSnapshot } from '@/static-content/calculator';
import { apiUrl, getView, hasApi } from './core';

/**
 * `/cost-calculator/`: the page's copy, the published price bands, the questions and the
 * published rates. Deduplicated within a request, so the page, its metadata and the server
 * action share one call, and never cached across requests: edited copy applies at once.
 */
export const getCalculatorPage = cache(
  (): Promise<CalculatorPageView> =>
    getView('/pages/cost-calculator', calculatorPageViewSchema, calculatorPageSnapshot),
);

/** One page, and no record behind it, so this needs nothing from the API. */
export function sitemapEntries(): Promise<SitemapEntry[]> {
  return Promise.resolve([{ path: CALCULATOR_PATH, title: 'Cost calculator', section: 'Plan a project' }]);
}

export type CalculatorPostResult =
  | { ok: true; estimate: CalculatorEstimate }
  | { ok: false; reason: 'invalid'; fieldErrors: Record<string, string[]> }
  | { ok: false; reason: 'rate_limited' | 'unavailable' | 'bot_check_failed' };

/**
 * Sends the answers to `POST /leads` as a CALCULATOR lead and returns the estimate the API
 * computed and stored. The figures always come back from the API: nothing in the browser
 * decides what a project costs.
 *
 * Without the API (the demo build) nothing can be stored, so this reports `unavailable`
 * and the page says the copy could not be sent.
 */
export async function postCalculatorLead(
  submission: LeadSubmission,
  visitorIp: string | null,
): Promise<CalculatorPostResult> {
  if (!hasApi()) return { ok: false, reason: 'unavailable' };
  let response: Response;
  try {
    response = await fetch(apiUrl('/leads'), {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        ...(visitorIp ? { 'x-forwarded-for': visitorIp } : {}),
      },
      body: JSON.stringify(submission),
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (response.status === 202) {
    const body = calculatorLeadReceivedSchema.safeParse(await response.json().catch(() => null));
    return body.success ? { ok: true, estimate: body.data.estimate } : { ok: false, reason: 'unavailable' };
  }
  if (response.status === 429) return { ok: false, reason: 'rate_limited' };
  if (response.status === 403) {
    const body = botCheckFailedResponseSchema.safeParse(await response.json().catch(() => null));
    if (body.success) return { ok: false, reason: 'bot_check_failed' };
  }
  if (response.status === 400) {
    const body = validationErrorResponseSchema.safeParse(await response.json().catch(() => null));
    if (body.success) return { ok: false, reason: 'invalid', fieldErrors: body.data.fieldErrors };
  }
  return { ok: false, reason: 'unavailable' };
}
