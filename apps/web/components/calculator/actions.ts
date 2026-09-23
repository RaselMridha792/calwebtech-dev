'use server';

import {
  CALCULATOR_FORM_ID,
  calculatorAnswersSchema,
  estimateProject,
  fillTemplate,
  leadSubmissionSchema,
  presentCalculatorResult,
  type CalculatorAnswers,
  type CalculatorPresentedResult,
} from '@calwebtech/shared';
import { headers } from 'next/headers';
import { getCalculatorPage, postCalculatorLead } from '@/lib/api/calculator';
import { attributionFromForm } from '@/lib/lead-form';
import { TURNSTILE_FIELD } from '@/lib/turnstile-field';

/**
 * What the visitor sees after the email step. `sent` means the answers are stored and the
 * copy is queued; `unsent` means nothing was stored or emailed and says so, rather than
 * pretending it was (docs/10-site-pages.md).
 */
export type CalculatorFormState =
  | { status: 'idle' }
  | { status: 'sent'; result: CalculatorPresentedResult; note: string }
  | { status: 'unsent'; result: CalculatorPresentedResult; note: string }
  | {
      status: 'error';
      message: string;
      fieldErrors: Record<string, string[]>;
      values: { name: string; email: string; company: string };
    };

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

/** The answers the calculator carried in its hidden field, or null when they are not valid. */
function answersFrom(form: FormData): CalculatorAnswers | null {
  const raw = text(form, 'answers');
  if (!raw) return null;
  try {
    const parsed = calculatorAnswersSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function visitorIp(forwardedFor: string | null, realIp: string | null): string | null {
  const first = forwardedFor?.split(',')[0]?.trim();
  return first ?? realIp ?? null;
}

/**
 * The email step of the cost calculator. It stores the lead through the API, which
 * recomputes the range from the answers, and returns that range in the page's own words.
 *
 * The browser never sends a price and never decides one: the figures here come from the
 * API's estimate, or, when nothing could be stored, from the same pricing model run on the
 * server, under a notice saying the copy was not sent.
 */
export async function submitCalculator(
  _previous: CalculatorFormState,
  form: FormData,
): Promise<CalculatorFormState> {
  const requestHeaders = await headers();
  const page = await getCalculatorPage();
  const copy = page.content.calculator;
  const values = { name: text(form, 'name'), email: text(form, 'email'), company: text(form, 'company') };
  const fail = (message: string, fieldErrors: Record<string, string[]> = {}): CalculatorFormState => ({
    status: 'error',
    message,
    fieldErrors,
    values,
  });

  const answers = answersFrom(form);
  if (!answers) return fail(copy.errors.invalid, { answers: [copy.labels.chooseOne] });

  const submission = leadSubmissionSchema.safeParse({
    type: 'CALCULATOR',
    formId: CALCULATOR_FORM_ID,
    name: values.name,
    email: values.email,
    company: values.company,
    answers,
    attribution: attributionFromForm(form, requestHeaders.get('referer')),
    referenceCode: text(form, 'referenceCode'),
    turnstileToken: text(form, TURNSTILE_FIELD),
  });
  if (!submission.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of submission.error.issues) {
      const key = issue.path.map(String).join('.') || '_form';
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return fail(copy.errors.invalid, fieldErrors);
  }

  const posted = await postCalculatorLead(
    submission.data,
    visitorIp(requestHeaders.get('x-forwarded-for'), requestHeaders.get('x-real-ip')),
  );
  if (posted.ok) {
    return {
      status: 'sent',
      result: presentCalculatorResult(posted.estimate, answers, page.content),
      note: fillTemplate(copy.result.emailed, { email: submission.data.email }),
    };
  }

  switch (posted.reason) {
    case 'invalid':
      return fail(copy.errors.invalid, posted.fieldErrors);
    case 'bot_check_failed':
      return fail(copy.errors.botCheck);
    case 'rate_limited':
      return fail(copy.errors.rateLimited);
    case 'unavailable':
      // Nothing was stored and nothing will be emailed. The range is still worked out here,
      // by the same model the API uses, under a notice that says the copy was not sent.
      return {
        status: 'unsent',
        result: presentCalculatorResult(estimateProject(answers), answers, page.content),
        note: copy.result.unsent,
      };
  }
}
