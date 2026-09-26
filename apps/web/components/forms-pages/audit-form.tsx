'use client';

import type { FormsAuditForm } from '@calwebtech/shared';
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { captureAttribution } from '@/lib/attribution-client';
import { submitLead, type LeadFormState } from '@/lib/lead-actions';
import { useTurnstile } from '../forms/use-turnstile';
import { ArrowIcon } from '../ui/icons';
import { Area, Choices, Field, type FormOption } from './fields';
import { FormClock } from '../forms/form-clock';

export interface AuditFormProps {
  copy: FormsAuditForm;
  /** `LEAD_AUDIT_CONCERNS`, passed in by the page so no value comes from the shared barrel. */
  concerns: readonly FormOption[];
  formId: string;
  thankYouPath: string;
  turnstileSiteKey: string | undefined;
}

const INITIAL: LeadFormState = { status: 'idle' };

const CHECK_PROBLEM = 'The security check did not finish. Please try again.';

/**
 * The free website audit request (docs/14-remaining-work.md, task 3): the site, what worries
 * the visitor about it, a competitor to compare against, and who to send the findings to.
 *
 * One step, posted as an AUDIT lead through the site's lead action. The browser checks the
 * required fields on submit; Turnstile then runs once and the lead is sent. The action is
 * dispatched by hand rather than set as the form's `action`, so a refused send keeps
 * everything the visitor typed instead of React resetting the form.
 */
export function AuditForm({ copy, concerns, formId, thankYouPath, turnstileSiteKey }: AuditFormProps) {
  const [state, dispatch, pending] = useActionState(submitLead, INITIAL);
  const [verifying, setVerifying] = useState(false);
  const [checkProblem, setCheckProblem] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const { containerRef, prepare, waitForToken, reset: resetTurnstile, remove: removeTurnstile } = useTurnstile(
    turnstileSiteKey,
    'free-website-audit',
  );

  useEffect(() => {
    if (state.status === 'success') {
      removeTurnstile();
      successRef.current?.focus();
      window.location.assign(thankYouPath);
    }
    if (state.status === 'error') {
      // A token is single use, and the server has now seen this one.
      resetTurnstile();
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state, thankYouPath, removeTurnstile, resetTurnstile]);

  if (state.status === 'success') {
    return (
      <div ref={successRef} role="status" tabIndex={-1} className="border-t border-hairline pt-8 outline-none">
        <p className="heading-lg text-ink">{copy.success.heading}</p>
        <p className="body-lg mt-3 text-ink-muted">{copy.success.body}</p>
      </div>
    );
  }

  const errors = state.status === 'error' ? state.fieldErrors : {};
  const error = (name: string) => errors[name]?.[0];
  const busy = pending || verifying;

  return (
    <form
      ref={formRef}
      className="border-t border-hairline pt-8"
      onFocus={() => {
        // Loads the check while the visitor is still typing, so sending waits on nothing.
        prepare().catch(() => undefined);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setCheckProblem(null);
        setVerifying(true);
        waitForToken(form).then(
          () => {
            setVerifying(false);
            const data = new FormData(form);
            data.set('attribution', JSON.stringify(captureAttribution()));
            startTransition(() => {
              dispatch(data);
            });
          },
          () => {
            setVerifying(false);
            setCheckProblem(CHECK_PROBLEM);
          },
        );
      }}
      aria-busy={busy}
    >
      {state.status === 'error' ? (
        <p role="alert" className="body-base mb-6 border-l-2 border-danger py-1 ps-4 text-ink">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-x-5 sm:grid-cols-2">
        <Field idPrefix="audit" name="siteUrl" copy={copy.fields.siteUrl} required autoComplete="url" error={error('siteUrl')} />
        <Field idPrefix="audit" name="competitorUrl" copy={copy.fields.competitorUrl} error={error('competitorUrl')} />
      </div>

      <div className="mt-2">
        <Choices name="mainConcern" legend options={concerns} label={copy.fields.mainConcern.label} error={error('mainConcern')} />
      </div>

      <div className="mt-7 grid gap-x-5 sm:grid-cols-2">
        <Field idPrefix="audit" name="name" copy={copy.fields.name} required autoComplete="name" minLength={2} error={error('name')} />
        <Field idPrefix="audit" name="email" copy={copy.fields.email} required type="email" autoComplete="email" error={error('email')} />
        <Field idPrefix="audit" name="company" copy={copy.fields.company} autoComplete="organization" error={error('company')} />
      </div>

      <div>
        <Area idPrefix="audit" name="message" copy={copy.fields.description} rows={4} error={error('message')} />
      </div>

      <input type="hidden" name="type" value="AUDIT" />
      <input type="hidden" name="formId" value={formId} />
      {/* The honeypot: out of sight and out of the tab order, so only a bot fills it. */}
      <div className="absolute left-[-10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="audit-reference">Reference code</label>
        <input id="audit-reference" type="text" name="referenceCode" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <FormClock />

      <button
        type="submit"
        disabled={busy}
        className="button-label mt-8 inline-flex min-h-12 items-center gap-2 bg-navy-900 px-6 text-ink-invert transition-colors duration-150 hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-40"
      >
        {busy ? 'Sending…' : copy.submitLabel}
        <ArrowIcon className="w-4" />
      </button>

      {checkProblem ? (
        <p role="alert" className="body-base mt-6 border-l-2 border-danger py-1 ps-4 text-ink">
          {checkProblem}
        </p>
      ) : null}
      {/* Turnstile renders here, and stays invisible unless it needs the visitor. */}
      <div ref={containerRef} className="mt-6 empty:hidden" />
      <p className="body-sm mt-6 max-w-[60ch] text-ink-muted">{copy.footnote}</p>
    </form>
  );
}
