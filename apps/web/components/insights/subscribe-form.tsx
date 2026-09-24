'use client';

import type { InsightsNewsletterCopy } from '@calwebtech/shared';
import { useActionState, useEffect, useRef, useState, type ComponentProps } from 'react';
import { TURNSTILE_FIELD, useTurnstile } from '../forms/use-turnstile';
import { subscribeToNewsletter, type NewsletterState } from '../subscribe/actions';

const INITIAL: NewsletterState = { status: 'idle' };

/**
 * The lines for what a visitor can act on. `unavailable` comes from the editable
 * `insights.copy` setting instead, so the block never claims to have sent.
 */
const MESSAGES = {
  invalid: 'Please enter a valid email address.',
  bot_check_failed: 'We could not confirm this request came from a person. Please try again.',
  rate_limited: 'You have sent several requests in a row. Please wait a minute and try again.',
} as const;

const CHECK_PROBLEM = 'We could not run the security check. Check your connection and try again.';

const controlClass =
  'h-12 w-full  border border-hairline bg-canvas-raised px-4 text-ink placeholder:text-ink-muted/60 focus:border-gold-ink aria-invalid:border-danger';

/**
 * The inline subscribe block inside an article: an email address and nothing else
 * (docs/08-decisions.md, 53). It creates a subscriber through the same server action and
 * `POST /subscribers` as the homepage's "Subscribe now", with the article's path as the
 * source page, so a segment can address the people who subscribed from an article.
 *
 * The only client component on the page: it holds the submission state and the Turnstile
 * widget. Without script it still posts, because the server action is the form's action and
 * the article URL is its permalink.
 */
export function SubscribeForm({
  copy,
  sourcePage,
  turnstileSiteKey,
}: {
  copy: InsightsNewsletterCopy;
  /** The article the block sits on; stored as the subscriber's source page. */
  sourcePage: string;
  turnstileSiteKey: string | undefined;
}) {
  const [state, formAction, pending] = useActionState(subscribeToNewsletter, INITIAL, sourcePage);
  const formRef = useRef<HTMLFormElement>(null);
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
    if (state.status === 'success') {
      removeTurnstile();
      successRef.current?.focus();
    }
    if (state.status === 'error') {
      // A token is single use, and the server has now seen this one.
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

  const failed = state.status === 'error';
  const invalid = failed && state.reason === 'invalid';
  const alert =
    checkProblem ??
    (failed && !invalid ? (state.reason === 'unavailable' ? copy.unavailable : MESSAGES[state.reason]) : null);
  const busy = pending || verifying;

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
      <input type="hidden" name="sourcePage" value={sourcePage} />
      {/* The honeypot: out of sight and out of the tab order, so only a bot fills it. */}
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
        <div className="flex-1">
          <label htmlFor="insights-subscribe-email" className="mb-1.5 block text-[14px] font-semibold text-ink">
            {copy.emailLabel}
          </label>
          <input
            id="insights-subscribe-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-required="true"
            defaultValue={failed ? state.email : ''}
            className={controlClass}
            {...(invalid ? { 'aria-invalid': true, 'aria-describedby': 'insights-subscribe-email-error' } : {})}
          />
          {invalid ? (
            <p id="insights-subscribe-email-error" className="mt-1.5 text-[13px] font-medium text-danger">
              {MESSAGES.invalid}
            </p>
          ) : null}
        </div>
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
