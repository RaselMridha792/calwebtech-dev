import { attributionSchema, type Attribution } from '@calwebtech/shared';
import { utmFromSearchParams } from './utm';
import { TURNSTILE_FIELD } from './turnstile-field';

function field(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === 'string' ? value : undefined;
}

/**
 * Attribution captured in the browser, or, when script did not run, whatever the
 * Referer of the form post reveals: the landing page path and its UTM tags.
 */
export function attributionFromForm(form: FormData, referer: string | null): Attribution {
  const raw = field(form, 'attribution');
  if (raw) {
    try {
      const parsed = attributionSchema.safeParse(JSON.parse(raw) as unknown);
      if (parsed.success) return parsed.data;
    } catch {
      // Malformed JSON falls through to the Referer.
    }
  }
  if (!referer || !URL.canParse(referer)) return {};
  const url = new URL(referer);
  return { lastTouch: utmFromSearchParams(url.searchParams), landingPage: url.pathname };
}

/** Maps a posted lead form onto the `leadSubmissionSchema` input shape. */
export function leadSubmissionFromForm(
  form: FormData,
  referer: string | null,
): Record<string, unknown> {
  return {
    type: field(form, 'type'),
    formId: field(form, 'formId'),
    name: field(form, 'name'),
    email: field(form, 'email'),
    company: field(form, 'company'),
    phone: field(form, 'phone'),
    siteUrl: field(form, 'siteUrl'),
    budgetBand: field(form, 'budgetBand'),
    timeline: field(form, 'timeline'),
    referralSource: field(form, 'referralSource'),
    serviceInterest: form.getAll('serviceInterest').filter((value) => typeof value === 'string'),
    message: field(form, 'message'),
    enquiryType: field(form, 'enquiryType'),
    landingPageSlug: field(form, 'landingPageSlug'),
    serviceSlug: field(form, 'serviceSlug'),
    // The start a project brief (docs/06-build-plan.md, task 5.2): what it is for, the links
    // the visitor wants read, and the draft that progressive saving already stored, so the
    // final submit completes that lead rather than creating a second one.
    projectType: field(form, 'projectType'),
    projectLinks: field(form, 'projectLinks'),
    draftId: field(form, 'draftId'),
    draftToken: field(form, 'draftToken'),
    // The free website audit: what worries the visitor, and a competitor to compare against.
    mainConcern: field(form, 'mainConcern'),
    competitorUrl: field(form, 'competitorUrl'),
    attribution: attributionFromForm(form, referer),
    referenceCode: field(form, 'referenceCode'),
    turnstileToken: field(form, TURNSTILE_FIELD),
  };
}
