'use client';

import type { SubscribeCopy } from '@calwebtech/shared';
import { useActionState, useEffect, useRef, useState, type ComponentProps } from 'react';
import { TURNSTILE_FIELD, useTurnstile } from '../forms/use-turnstile';
import { subscribeToNewsletter, type NewsletterState } from './actions';

const INITIAL: NewsletterState = { status: 'idle' };

const CHECK_PROBLEM = 'We could not run the security check. Check your connection and try again.';

/**
 * The "Subscribe now" form: one field, and nothing else asked of the visitor.
 *
 * The only client component in the band. It holds the submission state and the Turnstile
 * widget, and it still posts without script, because the server action is the form's action.
 * The flow is the one the lead forms already run — hold the first submit until Turnstile has
 * put a token in the form, then submit again — so a fix to one is a fix to both.
 */
export function SubscribeForm({
  copy,
  sourcePage,
  turnstileSiteKey,
}: {
  copy: SubscribeCopy;
  /**
   * The page the band sits on, stored with the subscriber. Passed in by the server component:
   * the constant lives in `@calwebtech/shared`, and importing a value from that barrel into a
   * client component carries all of Zod into the browser.
   */
  sourcePage: string;
  turnstileSiteKey: string | undefined;
}) {
  const [state, formAction, pending] = useActionState(subscribeToNewsletter, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const {
    containerRef,
    prepare,
    waitForToken,
    remove: removeTurnstile,
    reset: resetTurnstile,
  } = useTurnstile(turnstileSiteKey, 'newsletter-subscribe');
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
        <p ref={successRef} tabIndex={-1} className="heading-md text-ink">
          {copy.success}
        </p>
      </div>
    );
  }

  const failed = state.status === 'error';
  const invalid = failed && state.reason === 'invalid';
  const alert =
    checkProblem ??
    (failed
      ? state.reason === 'invalid'
        ? copy.invalid
        : state.reason === 'bot_check_failed'
          ? copy.botCheck
          : state.reason === 'rate_limited'
            ? copy.rateLimited
            : copy.unavailable
      : null);
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
    >
      <input type="hidden" name="sourcePage" value={sourcePage} />
      {/* The honeypot: out of sight and out of the tab order, so only a bot fills it. */}
      <div className="absolute left-[-10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="subscribe-reference">Reference code</label>
        <input id="subscribe-reference" type="text" name="referenceCode" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <label htmlFor="subscribe-email" className="eyebrow block text-ink-muted">
        {copy.emailLabel}
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="subscribe-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-required="true"
          placeholder={copy.placeholder}
          defaultValue={failed ? state.email : ''}
          className="h-14 w-full min-w-0 border border-hairline bg-canvas-raised px-4 text-ink placeholder:text-ink-muted/60 focus:border-gold-ink aria-invalid:border-danger"
          {...(invalid ? { 'aria-invalid': true, 'aria-describedby': 'subscribe-alert' } : {})}
        />
        <button
          type="submit"
          disabled={busy}
          className="button-label inline-flex h-14 shrink-0 items-center justify-center bg-navy-900 px-8 text-ink-invert transition-colors duration-150 hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-70"
        >
          {busy ? 'Sending…' : copy.submitLabel}
        </button>
      </div>

      {alert ? (
        <p id="subscribe-alert" role="alert" className="mt-3 text-[14px] font-medium text-danger">
          {alert}
        </p>
      ) : null}

      {/* Turnstile renders here, and stays invisible unless it needs the visitor. */}
      <div ref={containerRef} className="mt-3 empty:hidden" />
      <p className="body-sm mt-4 text-ink-muted">{copy.consent}</p>
    </form>
  );
}
