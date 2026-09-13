'use server';

import { leadSubmissionSchema, toFieldErrors } from '@calwebtech/shared';
import { headers } from 'next/headers';
import { postLead } from './api';
import { leadSubmissionFromForm } from './lead-form';

export type LeadFormState =
  | { status: 'idle' }
  | { status: 'success' }
  | {
      status: 'error';
      message: string;
      fieldErrors: Record<string, string[]>;
      /** Echoed back so React's automatic form reset restores what the visitor typed. */
      values: Record<string, string | string[]>;
    };

const ECHOED_FIELDS = [
  'name',
  'email',
  'company',
  'phone',
  'siteUrl',
  'budgetBand',
  'timeline',
  'message',
];

function submittedValues(form: FormData): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  for (const name of ECHOED_FIELDS) {
    const value = form.get(name);
    if (typeof value === 'string') values[name] = value;
  }
  values.serviceInterest = form.getAll('serviceInterest').filter((v) => typeof v === 'string');
  return values;
}

function visitorIp(forwardedFor: string | null, realIp: string | null): string | null {
  const first = forwardedFor?.split(',')[0]?.trim();
  return first ?? realIp ?? null;
}

/**
 * Public lead forms post here. The shape is checked with the shared schema for
 * fast field errors; the API validates again and owns every business rule.
 */
export async function submitLead(_previous: LeadFormState, form: FormData): Promise<LeadFormState> {
  const requestHeaders = await headers();
  const fail = (message: string, fieldErrors: Record<string, string[]> = {}): LeadFormState => ({
    status: 'error',
    message,
    fieldErrors,
    values: submittedValues(form),
  });

  const parsed = leadSubmissionSchema.safeParse(
    leadSubmissionFromForm(form, requestHeaders.get('referer')),
  );
  if (!parsed.success) {
    return fail('Please check the highlighted fields.', toFieldErrors(parsed.error));
  }

  const result = await postLead(
    parsed.data,
    visitorIp(requestHeaders.get('x-forwarded-for'), requestHeaders.get('x-real-ip')),
  );
  if (result.ok) return { status: 'success' };

  switch (result.reason) {
    case 'invalid':
      return fail('Please check the highlighted fields.', result.fieldErrors);
    case 'rate_limited':
      return fail('You have sent several requests in a row. Please wait a minute and try again.');
    case 'unavailable':
      return fail('We could not send that just now. Please try again, or call us.');
  }
}
