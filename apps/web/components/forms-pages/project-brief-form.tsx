'use client';

import type { FormsProjectForm } from '@calwebtech/shared';
import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { captureAttribution } from '@/lib/attribution-client';
import { submitLead, type LeadFormState } from '@/lib/lead-actions';
import { TURNSTILE_FIELD, useTurnstile } from '../forms/use-turnstile';
import { ArrowIcon } from '../ui/icons';
import { saveProjectDraft } from './actions';
import { Area, Choices, Field, type FormOption } from './fields';

export interface ProjectBriefFormProps {
  copy: FormsProjectForm;
  /** `LEAD_PROJECT_TYPES`, `BUDGET_BANDS` and `START_TIMELINES`, passed in by the page: a value
   *  import from the shared barrel would carry all of Zod into this bundle (decision 47). */
  projectTypes: readonly FormOption[];
  budgets: readonly FormOption[];
  timelines: readonly FormOption[];
  services: readonly { slug: string; title: string }[];
  formId: string;
  thankYouPath: string;
  turnstileSiteKey: string | undefined;
}

/** The step that holds each field, for sending the visitor back to an error the API found. */
const STEP_OF_FIELD: Record<string, number> = {
  projectType: 0,
  name: 1,
  email: 1,
  company: 1,
  phone: 1,
  siteUrl: 1,
  serviceInterest: 2,
  budgetBand: 3,
  timeline: 4,
  message: 5,
  projectLinks: 5,
};

/** The contact step: an email address is what lets the API store an unfinished brief. */
const CONTACT_STEP = 1;

const CHECK_PROBLEM = 'The security check did not finish. Please try again.';

const INITIAL: LeadFormState = { status: 'idle' };

/**
 * The start a project brief (docs/06-build-plan.md, task 5.2): six steps, one question each.
 *
 * It follows the booking form's pattern (decision 47). Every step is in the DOM and only the
 * current one is shown, so nothing typed is lost between steps; `reportValidity()` runs on a
 * step's own fields before it hides them; Turnstile runs once, on the final send.
 *
 * From the contact step on, each move forward saves the brief (`saveProjectDraft`) with the
 * step reached. That is what makes abandonment measurable per step: a brief left on step four
 * is a lead that says so. The final send goes through the site's lead action and completes the
 * same lead, so one brief is one row. Saving never blocks the visitor, and the page says a
 * brief is saved only when the API said so.
 */
export function ProjectBriefForm({
  copy,
  projectTypes,
  budgets,
  timelines,
  services,
  formId,
  thankYouPath,
  turnstileSiteKey,
}: ProjectBriefFormProps) {
  const [state, dispatch, pending] = useActionState(submitLead, INITIAL);
  const [current, setCurrent] = useState(0);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<{ id: string; token: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [checkProblem, setCheckProblem] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const legendRefs = useRef<(HTMLLegendElement | null)[]>([]);
  const successRef = useRef<HTMLDivElement>(null);
  /** Saves run one after another, and each reads the draft the one before it created. */
  const savingRef = useRef<Promise<void>>(Promise.resolve());
  const draftRef = useRef<{ id: string; token: string } | null>(null);
  /** False until the visitor first moves, so the page does not steal focus on load. */
  const [moved, setMoved] = useState(false);
  const [seen, setSeen] = useState(state);
  const { containerRef, prepare, waitForToken, reset: resetTurnstile, remove: removeTurnstile } = useTurnstile(
    turnstileSiteKey,
    'start-a-project',
  );

  const total = copy.steps.length;
  const last = total - 1;
  const errors = state.status === 'error' ? state.fieldErrors : {};

  // A refused send opens the step holding the first field the API refused. Adjusted while
  // rendering, the way React recommends for state that follows another, not in an effect.
  if (state !== seen) {
    setSeen(state);
    if (state.status === 'error') {
      const first = Object.keys(state.fieldErrors)[0];
      const step = first === undefined ? undefined : STEP_OF_FIELD[first];
      if (step !== undefined) {
        setMoved(true);
        setCurrent(step);
      }
    }
  }

  // A step change moves focus to the new step's question, so a keyboard or screen reader user
  // lands where the page changed rather than on a button that has gone.
  useEffect(() => {
    if (moved) legendRefs.current[current]?.focus();
  }, [current, moved]);

  useEffect(() => {
    if (state.status === 'success') {
      removeTurnstile();
      successRef.current?.focus();
      window.location.assign(thankYouPath);
    }
    // A token is single use, and the server has now seen this one.
    if (state.status === 'error') resetTurnstile();
  }, [state, thankYouPath, removeTurnstile, resetTurnstile]);

  const go = (step: number) => {
    setMoved(true);
    setCurrent(step);
  };

  /**
   * The fields of one step, checked with the browser's own messages before the step hides.
   * `report` is off for a step that is not on screen: a hidden field cannot show a message,
   * so the caller opens that step instead.
   */
  const stepIsValid = (step: number, report = true): boolean => {
    const fields = formRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      `[data-step="${String(step)}"] input:not([type="hidden"]), [data-step="${String(step)}"] textarea`,
    );
    for (const field of fields ?? []) {
      if (!field.checkValidity()) {
        if (report) field.reportValidity();
        return false;
      }
    }
    return true;
  };

  const payload = (): FormData | null => {
    const form = formRef.current;
    if (!form) return null;
    const data = new FormData(form);
    data.set('attribution', JSON.stringify(captureAttribution()));
    const known = draftRef.current;
    if (known) {
      data.set('draftId', known.id);
      data.set('draftToken', known.token);
    }
    return data;
  };

  /** Saves the brief at `reached` (1 to 6). Quiet on failure; the final send is what counts. */
  const save = (reached: number) => {
    savingRef.current = savingRef.current.then(async () => {
      const data = payload();
      if (!data) return;
      data.set('step', String(reached));
      try {
        const result = await saveProjectDraft(data);
        if (result.draft) {
          draftRef.current = { id: result.draft.id, token: result.draft.token };
          setDraft(draftRef.current);
          setSaved(true);
        }
      } catch {
        // A draft is a convenience: nothing to tell the visitor.
      }
    });
  };

  const next = () => {
    if (!stepIsValid(current)) return;
    const to = current + 1;
    if (to > CONTACT_STEP) save(to + 1);
    if (to === last) prepare().catch(() => undefined);
    go(to);
  };

  const send = () => {
    // The contact step's fields are required wherever the visitor is.
    if (!stepIsValid(CONTACT_STEP, current === CONTACT_STEP)) {
      go(CONTACT_STEP);
      return;
    }
    if (!stepIsValid(current)) return;
    const form = formRef.current;
    if (!form) return;
    setCheckProblem(null);
    setVerifying(true);
    void savingRef.current
      .then(() => waitForToken(form))
      .then(
        () => {
          setVerifying(false);
          const data = payload();
          if (!data) return;
          data.set(TURNSTILE_FIELD, form.querySelector<HTMLInputElement>(`input[name="${TURNSTILE_FIELD}"]`)?.value ?? '');
          startTransition(() => {
            dispatch(data);
          });
        },
        () => {
          setVerifying(false);
          setCheckProblem(CHECK_PROBLEM);
        },
      );
  };

  if (state.status === 'success') {
    return (
      <div ref={successRef} role="status" tabIndex={-1} className="border-t border-hairline pt-8 outline-none">
        <p className="heading-lg text-ink">{copy.success.heading}</p>
        <p className="body-lg mt-3 text-ink-muted">{copy.success.body}</p>
      </div>
    );
  }

  const busy = pending || verifying;
  const error = (name: string) => errors[name]?.[0];
  const stepCopy = copy.steps;

  const step = (index: number, children: ReactNode) => {
    const entry = stepCopy[index];
    if (!entry) return null;
    return (
      <fieldset key={entry.key} data-step={index} hidden={index !== current} className="min-w-0">
        <legend
          ref={(node) => {
            legendRefs.current[index] = node;
          }}
          tabIndex={-1}
          className="heading-lg text-ink outline-none"
        >
          {entry.legend}
        </legend>
        <p className="body-base mt-2 max-w-[60ch] text-ink-muted">{entry.hint}</p>
        <div className="mt-7">{children}</div>
      </fieldset>
    );
  };

  return (
    <form
      ref={formRef}
      className="border-t border-hairline pt-8"
      // The browser would otherwise check every step's fields on each press of Next, including
      // the required ones on steps it cannot show, and refuse to submit at all. Each step is
      // checked on its own instead (`stepIsValid`), with the same native messages.
      noValidate
      onSubmit={(event) => {
        // Enter in a field moves the brief on, or sends it from the last step.
        event.preventDefault();
        if (current === last) send();
        else next();
      }}
      aria-busy={busy}
    >
      <p className="meta text-gold-ink" aria-live="polite">
        {`${copy.stepLabel} ${String(current + 1)} ${copy.ofLabel} ${String(total)}`}
      </p>
      <div className="mt-2 h-px w-full bg-hairline" aria-hidden="true">
        <div className="h-px bg-gold-ink" style={{ width: `${String(((current + 1) / total) * 100)}%` }} />
      </div>

      {state.status === 'error' ? (
        <p role="alert" className="body-base mt-6 border-l-2 border-danger py-1 ps-4 text-ink">
          {state.message}
        </p>
      ) : null}

      <div className="mt-8">
        {step(
          0,
          <Choices name="projectType" options={projectTypes} label={copy.fields.projectType.label} error={error('projectType')} />,
        )}

        {step(
          1,
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field idPrefix="brief" name="name" copy={copy.fields.name} required autoComplete="name" minLength={2} error={error('name')} />
              <Field idPrefix="brief" name="email" copy={copy.fields.email} required type="email" autoComplete="email" error={error('email')} />
              <Field idPrefix="brief" name="company" copy={copy.fields.company} autoComplete="organization" error={error('company')} />
              <Field idPrefix="brief" name="phone" copy={copy.fields.phone} type="tel" autoComplete="tel" error={error('phone')} />
              <Field idPrefix="brief" name="siteUrl" copy={copy.fields.siteUrl} autoComplete="url" error={error('siteUrl')} />
            </div>
            <p className="body-sm mt-5 max-w-[60ch] text-ink-muted">{copy.saveNote}</p>
          </>,
        )}

        {step(
          2,
          services.length > 0 ? (
            <Choices
              name="serviceInterest"
              multiple
              options={services.map((service) => ({ value: service.title, label: service.title }))}
              label={copy.fields.serviceInterest.label}
              error={error('serviceInterest')}
            />
          ) : (
            <p className="body-base text-ink-muted">{copy.servicesEmpty}</p>
          ),
        )}

        {step(3, <Choices name="budgetBand" options={budgets} label={copy.fields.budgetBand.label} error={error('budgetBand')} />)}

        {step(4, <Choices name="timeline" options={timelines} label={copy.fields.timeline.label} error={error('timeline')} />)}

        {step(
          5,
          <>
            <Area idPrefix="brief" name="message" copy={copy.fields.description} rows={6} error={error('message')} />
            <div className="mt-5">
              <Area idPrefix="brief" name="projectLinks" copy={copy.fields.projectLinks} rows={3} error={error('projectLinks')} />
            </div>
            <p className="body-sm mt-5 max-w-[60ch] text-ink-muted">{copy.uploadNote}</p>
          </>,
        )}
      </div>

      <input type="hidden" name="type" value="PROJECT" />
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="draftId" value={draft?.id ?? ''} />
      <input type="hidden" name="draftToken" value={draft?.token ?? ''} />
      {/* The honeypot: out of sight and out of the tab order, so only a bot fills it. */}
      <div className="absolute left-[-10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="brief-reference">Reference code</label>
        <input id="brief-reference" type="text" name="referenceCode" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {current > 0 ? (
          <button
            type="button"
            onClick={() => {
              go(current - 1);
            }}
            className="button-label min-h-12 border border-hairline px-5 text-ink transition-colors duration-150 hover:border-hairline-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {copy.backLabel}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="button-label inline-flex min-h-12 items-center gap-2 bg-navy-900 px-6 text-ink-invert transition-colors duration-150 hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-40"
        >
          {current === last ? (busy ? 'Sending…' : copy.submitLabel) : copy.nextLabel}
          <ArrowIcon className="w-4" />
        </button>
        <p className="body-sm text-ink-muted" aria-live="polite">
          {saved ? copy.savedLabel : ''}
        </p>
      </div>

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
