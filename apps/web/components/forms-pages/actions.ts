'use server';

import { formsProjectDraftSchema, type FormsProjectDraftResult } from '@calwebtech/shared';
import { headers } from 'next/headers';
import { postProjectDraft } from '@/lib/api/forms';
import { leadSubmissionFromForm } from '@/lib/lead-form';

/** Nothing was stored. The brief never tells the visitor otherwise. */
const NOT_SAVED: FormsProjectDraftResult = { status: 'saved', draft: null };

/**
 * Stores the unfinished brief each time the visitor moves on from the contact step
 * (`POST /forms/project-draft`), with the step they have reached. That step on the lead is
 * what makes abandonment measurable per step (docs/06-build-plan.md, task 5.2).
 *
 * The form is read with the same mapper as the final submit, so a draft can never hold
 * something the submit would refuse. A draft that does not validate yet, such as a name of
 * one letter, is simply not saved: this is a convenience, and the visitor is not told about
 * our plumbing. The final submit reports honestly whether the lead was stored.
 */
export async function saveProjectDraft(form: FormData): Promise<FormsProjectDraftResult> {
  const requestHeaders = await headers();
  const parsed = formsProjectDraftSchema.safeParse({
    ...leadSubmissionFromForm(form, requestHeaders.get('referer')),
    step: Number(form.get('step')),
  });
  if (!parsed.success) return NOT_SAVED;

  // The proxy in front of the web app sets this; the API rate limits on it.
  const visitorIp = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  return postProjectDraft(parsed.data, visitorIp);
}
