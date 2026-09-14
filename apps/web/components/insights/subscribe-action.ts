'use server';

import { INSIGHTS_NEWSLETTER_FORM_ID, leadSubmissionSchema, toFieldErrors } from '@calwebtech/shared';
import { headers } from 'next/headers';
import { postLead } from '@/lib/api';
import { leadSubmissionFromForm } from '@/lib/lead-form';

/**
 * The inline subscribe block on an article posts here. It is the site's lead flow with one
 * thing fixed: the lead is a RESOURCE lead named by `INSIGHTS_NEWSLETTER_FORM_ID`. The API
 * validates again and owns every rule; without the API nothing can be stored, so the block
 * says it could not send.
 *
 * The page the block sat on is posted as `sourcePage` but dropped by the foundation today:
 * `leadSubmissionSchema` has no field for it and `leadSubmissionFromForm` does not read it.
 * The family's report asks the foundation for `sourcePage` (docs/02-content-model.md,
 * "Newsletter: sourcePage") rather than widening the shared lead contract from a page.
 *
 * The confirmation email is the foundation's default line for the same reason. Repeating the
 * `insights.copy` success copy the subscriber just read would mean a branch on this form id
 * inside `apps/api/src/leads/`; the report asks instead for a form id to setting-and-copy-path
 * registry the families append to, the way `PAGE_SEEDS` works in `packages/db/src/seed/pages/`.
 */
export type SubscribeReason = 'bot_check_failed' | 'invalid' | 'rate_limited' | 'unavailable';

export type SubscribeState =
  | { status: 'idle' }
  | { status: 'success' }
  | {
      status: 'error';
      reason: SubscribeReason;
      fieldErrors: Record<string, string[]>;
      /** Echoed back so React's automatic form reset restores what the visitor typed. */
      values: { name: string; email: string };
    };

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function visitorIp(forwardedFor: string | null, realIp: string | null): string | null {
  const first = forwardedFor?.split(',')[0]?.trim();
  return first ?? realIp ?? null;
}

export async function subscribeToInsights(_previous: SubscribeState, form: FormData): Promise<SubscribeState> {
  const requestHeaders = await headers();
  const values = { name: text(form, 'name'), email: text(form, 'email') };
  const fail = (reason: SubscribeReason, fieldErrors: Record<string, string[]> = {}): SubscribeState => ({
    status: 'error',
    reason,
    fieldErrors,
    values,
  });

  const parsed = leadSubmissionSchema.safeParse({
    ...leadSubmissionFromForm(form, requestHeaders.get('referer')),
    type: 'RESOURCE',
    formId: INSIGHTS_NEWSLETTER_FORM_ID,
  });
  if (!parsed.success) return fail('invalid', toFieldErrors(parsed.error));

  const result = await postLead(
    parsed.data,
    visitorIp(requestHeaders.get('x-forwarded-for'), requestHeaders.get('x-real-ip')),
  );
  if (result.ok) return { status: 'success' };
  return result.reason === 'invalid' ? fail('invalid', result.fieldErrors) : fail(result.reason);
}
