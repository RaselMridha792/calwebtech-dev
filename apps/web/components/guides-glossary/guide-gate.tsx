'use client';

import { GUIDE_GATE_FORM_ID, type GuideDetailView } from '@calwebtech/shared';
import { useActionState, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { TURNSTILE_FIELD, useTurnstile } from '@/components/forms/use-turnstile';
import { captureAttribution } from '@/lib/attribution-client';
import { submitLead, type LeadFormState } from '@/lib/lead-actions';

/**
 * The email gate in front of a guide's download. It asks for a name and a work email only,
 * posts a RESOURCE lead naming the guide through the same server action as every other form,
 * and then reveals the file on the page. The summary above it is never hidden (docs/03).
 *
 * Without the API the server action answers that it could not send, and the download stays
 * behind the gate rather than pretending the request was stored.
 */
const CHECK_PROBLEM = 'We could not run the security check. Check your connection and try again, or call us.';

const initialState: LeadFormState = { status: 'idle' };

function writeAttribution(input: HTMLInputElement | null): void {
  if (input) input.value = JSON.stringify(captureAttribution());
}

const controlClass =
  'h-12 w-full rounded-lg border border-line bg-white px-4 text-ink placeholder:text-body/60 focus:border-primary aria-invalid:border-danger';

export function GuideGate({
  slug,
  permalink,
  gate,
  turnstileSiteKey,
}: {
  slug: string;
  permalink: string;
  gate: GuideDetailView['gate'];
  turnstileSiteKey?: string;
}) {
  const [state, formAction, pending] = useActionState(submitLead, initialState, permalink);
  const attributionRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const {
    containerRef: turnstileContainerRef,
    prepare: prepareTurnstile,
    waitForToken,
    remove: removeTurnstile,
    reset: resetTurnstile,
  } = useTurnstile(turnstileSiteKey, GUIDE_GATE_FORM_ID);
  const [verifying, setVerifying] = useState(false);
  const [checkProblem, setCheckProblem] = useState<string | null>(null);

  const startTurnstile = () => {
    // Problems surface on submit, where the visitor can act on them.
    prepareTurnstile().catch(() => undefined);
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
      <div ref={successRef} tabIndex={-1} role="status" className="rounded-2xl border border-line bg-white p-7 shadow-panel">
        <p className="font-display text-[22px] font-extrabold text-ink">{gate.success.heading}</p>
        <p className="mt-3 text-[15.5px] leading-relaxed">{gate.success.body}</p>
        <a
          href={gate.fileUrl}
          download
          className="mt-6 inline-flex h-14 items-center rounded-xl bg-primary px-7 text-[16px] font-semibold text-white shadow-cta hover:bg-primaryd"
        >
          {gate.success.downloadLabel}
        </a>
        <p className="mt-3 text-[13px]">{gate.fileLabel}</p>
      </div>
    );
  }

  const errors = state.status === 'error' ? state.fieldErrors : {};
  const values = state.status === 'error' ? state.values : {};
  const value = (name: string) => {
    const current = values[name];
    return typeof current === 'string' ? current : undefined;
  };
  const alertMessage = checkProblem ?? (state.status === 'error' ? state.message : null);
  const busy = pending || verifying;
  const field = (name: 'name' | 'email', label: string, input: (control: Control) => ReactNode) => {
    const id = `${GUIDE_GATE_FORM_ID}-${name}`;
    const message = errors[name]?.[0];
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold text-ink">
          {label}
        </label>
        {input({ id, name, ...(message ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {}) })}
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
      className="rounded-2xl border border-line bg-white p-7 shadow-panel"
    >
      <input type="hidden" name="type" value="RESOURCE" />
      <input type="hidden" name="formId" value={GUIDE_GATE_FORM_ID} />
      <input type="hidden" name="guideSlug" value={slug} />
      <input ref={attributionRef} type="hidden" name="attribution" defaultValue="" />
      <div className="absolute left-[-10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={`${GUIDE_GATE_FORM_ID}-reference`}>Reference code</label>
        <input
          id={`${GUIDE_GATE_FORM_ID}-reference`}
          type="text"
          name="referenceCode"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {alertMessage ? (
        <p role="alert" className="mb-5 text-[14px] font-medium text-danger">
          {alertMessage}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {field('name', 'Full name', (control) => (
          <input
            {...control}
            type="text"
            autoComplete="name"
            aria-required="true"
            defaultValue={value('name')}
            className={controlClass}
          />
        ))}
        {field('email', 'Work email', (control) => (
          <input
            {...control}
            type="email"
            autoComplete="email"
            aria-required="true"
            defaultValue={value('email')}
            placeholder="you@company.com"
            className={controlClass}
          />
        ))}
      </div>

      {/* Turnstile renders here, and stays invisible unless it needs the visitor. */}
      <div ref={turnstileContainerRef} className="empty:hidden" />

      <button
        type="submit"
        disabled={busy}
        className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-xl bg-primary px-8 text-[16px] font-semibold text-white shadow-cta hover:bg-primaryd disabled:opacity-70 sm:w-auto"
      >
        {busy ? 'Sending…' : gate.submitLabel}
      </button>
      {gate.footnote ? <p className="mt-4 text-[13px]">{gate.footnote}</p> : null}
    </form>
  );
}

interface Control {
  id: string;
  name: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}
