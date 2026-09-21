'use client';

import type { InsightsNewsletterCopy } from '@calwebtech/shared';
import { useActionState, useEffect, useRef, useState, type ComponentProps } from 'react';
import { captureAttribution } from '@/lib/attribution-client';
import { TURNSTILE_FIELD, useTurnstile } from '../forms/use-turnstile';
import { subscribeToInsights, type SubscribeReason, type SubscribeState } from './subscribe-action';

const INITIAL: SubscribeState = { status: 'idle' };

const MESSAGES: Record<Exclude<SubscribeReason, 'unavailable'>, string> = {
  invalid: 'Please check the highlighted fields.',
  bot_check_failed: 'We could not confirm this request came from a person. Please try again.',
  rate_limited: 'You have sent several requests in a row. Please wait a minute and try again.',
};

const CHECK_PROBLEM = 'We could not run the security check. Check your connection and try again.';

function writeAttribution(input: HTMLInputElement | null): void {
  if (input) input.value = JSON.stringify(captureAttribution());
}

const controlClass =
  'h-12 w-full  border border-hairline bg-canvas-raised px-4 text-ink placeholder:text-ink-muted/60 focus:border-gold-ink aria-invalid:border-danger';

/**
 * The inline subscribe block inside an article. The only client component on the page:
 * it holds the submission state and the Turnstile widget. Without script it still posts,
 * because the server action is the form's action and the article URL is its permalink.
 *
 * This is a second copy of the flow `components/forms/lead-form.tsx` already runs, and it
 * should not stay one: a change to the lead protections would have to be made twice. Folding
 * it in needs three foundation changes, which the family's report asks for rather than making
 * — a `newsletter` variant of `LeadForm` with its own `unavailable` copy (the block takes that
 * line from the editable `insights.copy` setting, while `lib/lead-actions.ts` hard-codes it),
 * a `sourcePage` field on the shared lead contract, and `leadSubmissionFromForm` reading it.
 * Until then the markup below is gated by `components/insights/insights.test.tsx`.
 */
export function SubscribeForm({
  copy,
  sourcePage,
  turnstileSiteKey,
}: {
  copy: InsightsNewsletterCopy;
  /** The article the block sits on; stored with the lead. */
  sourcePage: string;
  turnstileSiteKey: string | undefined;
}) {
  const [state, formAction, pending] = useActionState(subscribeToInsights, INITIAL, sourcePage);
  const formRef = useRef<HTMLFormElement>(null);
  const attributionRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const {
    containerRef,
    prepare,
    waitForToken,
    remove: removeTurnstile,
    reset: resetTurnstile,
  } = useTurnstile(turnstileSiteKey, 'insights-subscribe');
  const [verifying, setVerifying] = useState(false);
  const [checkProblem, setCheckProblem] = useState<string | null>(null);

  const startTurnstile = () => {
    // Problems surface on submit, where the visitor can act on them.
    prepare().catch(() => undefined);
  };

  /** Holds the first submit until Turnstile has put a token in the form, then submits again. */
  const handleSubmit: NonNullable<ComponentProps<'form'>['onSubmit']> = (event) => {
    writeAttribution(attributionRef.current);
    if (!turnstileSiteKey) return;
    const form = event.currentTarget;
    if (form.querySelector<HTMLInputElement>(`input[name="${TURNSTILE_FIELD}"]`)?.value) return;

    event.preventDefault();
    setCheckProblem(null);
    setVerifying(true);
    waitForToken(form).then(
      () => {
        setVerifying(false);
        form.requestSubmit();
      },
      () => {
        setVerifying(false);
        setCheckProblem(CHECK_PROBLEM);
      },
    );
  };

  useEffect(() => {
    writeAttribution(attributionRef.current);
  }, []);

  useEffect(() => {
    if (state.status === 'success') {
      removeTurnstile();
      successRef.current?.focus();
    }
    if (state.status === 'error') {
      resetTurnstile();
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state, removeTurnstile, resetTurnstile]);

  if (state.status === 'success') {
    return (
      <div role="status">
        <p ref={successRef} tabIndex={-1} className="font-display text-[19px] font-extrabold text-ink">
          {copy.success.heading}
        </p>
        <p className="mt-2.5 text-[15.5px] leading-relaxed">{copy.success.body}</p>
      </div>
    );
  }

  const errors = state.status === 'error' ? state.fieldErrors : {};
  const values = state.status === 'error' ? state.values : { name: '', email: '' };
  const alert =
    checkProblem ??
    (state.status === 'error'
      ? state.reason === 'unavailable'
        ? copy.unavailable
        : MESSAGES[state.reason]
      : null);
  const busy = pending || verifying;

  const field = (name: 'email' | 'name', label: string, type: 'email' | 'text', autoComplete: string) => {
    const id = `insights-subscribe-${name}`;
    const message = errors[name]?.[0];
    return (
      <div className="flex-1">
        <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold text-ink">
          {label}
        </label>
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          aria-required="true"
          defaultValue={values[name]}
          className={controlClass}
          {...(message ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {})}
        />
        {message ? (
          <p id={`${id}-error`} className="mt-1.5 text-[13px] font-medium text-danger">
            {message}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      onFocus={startTurnstile}
      onPointerDown={startTurnstile}
      noValidate
      aria-busy={busy}
      className="mt-6"
    >
      {/*
        The article the block sat on. The shared lead contract has no field for it yet, so the
        foundation drops it today; the family's report asks for `sourcePage` on
        `leadSubmissionSchema` rather than widening it from a page (subscribe-action.ts).
      */}
      <input type="hidden" name="sourcePage" value={sourcePage} />
      <input ref={attributionRef} type="hidden" name="attribution" defaultValue="" />
      <div className="absolute left-[-10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="insights-subscribe-reference">Reference code</label>
        <input id="insights-subscribe-reference" type="text" name="referenceCode" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {alert ? (
        <p role="alert" className="mb-4 text-[14px] font-medium text-danger">
          {alert}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        {field('name', copy.nameLabel, 'text', 'name')}
        {field('email', copy.emailLabel, 'email', 'email')}
        <button
          type="submit"
          disabled={busy}
          className="h-12 shrink-0 bg-navy-900 px-6 text-[15.5px] font-semibold text-ink-invert hover:bg-navy-700 disabled:opacity-70"
        >
          {busy ? 'Sending…' : copy.submitLabel}
        </button>
      </div>

      {/* Turnstile renders here, and stays invisible unless it needs the visitor. */}
      <div ref={containerRef} className="mt-4 empty:hidden" />
      <p className="mt-4 text-[13.5px] leading-relaxed">{copy.privacyNote}</p>
    </form>
  );
}
