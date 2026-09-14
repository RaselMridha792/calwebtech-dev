'use client';

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from 'react';
import { captureAttribution } from '@/lib/attribution-client';
import { TURNSTILE_FIELD, useTurnstile } from '../forms/use-turnstile';
import { submitCalculator, type CalculatorFormState } from './actions';
import { track } from './events';
import type { CalculatorStepView, CalculatorViewProps } from './types';

/**
 * The cost calculator: eight questions, an email step and the result (docs/03-page-specs.md).
 *
 * It is loaded on demand by calculator-loader.tsx, so none of this is in the page's initial
 * JavaScript. It holds the answers and nothing else: the copy, the questions and the answer
 * values arrive as props from the server, the range comes back from the API, and the words
 * of the result are built there too. Nothing in the browser decides what a project costs.
 */

const initialState: CalculatorFormState = { status: 'idle' };

/** `{name}` placeholders in an editable label. The same rule as fillTemplate in the contract. */
function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

const PRIMARY_BUTTON =
  'inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-[15.5px] font-semibold text-white hover:bg-primaryd disabled:opacity-70';
const QUIET_BUTTON =
  'inline-flex h-12 items-center justify-center rounded-xl border border-line px-6 text-[15.5px] font-semibold text-ink hover:border-ink hover:bg-mist2';
const CONTROL = 'h-12 w-full rounded-lg border border-line bg-white px-4 text-ink focus:border-primary aria-invalid:border-danger';

export function Calculator({ copy, steps, events, permalink, turnstileSiteKey }: CalculatorViewProps) {
  const [state, formAction, pending] = useActionState(submitCalculator, initialState, permalink);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const [missing, setMissing] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [checkProblem, setCheckProblem] = useState<string | null>(null);

  const questionRef = useRef<HTMLHeadingElement>(null);
  const optionsRef = useRef<HTMLFieldSetElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const attributionRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const direction = useRef<'start' | 'next' | 'back'>('start');

  const {
    containerRef: turnstileContainerRef,
    prepare: prepareTurnstile,
    waitForToken,
    remove: removeTurnstile,
    reset: resetTurnstile,
  } = useTurnstile(turnstileSiteKey, 'cost-calculator');

  const total = steps.length;
  const atGate = index === total;
  const done = state.status === 'sent' || state.status === 'unsent';
  const step: CalculatorStepView | undefined = steps[index];

  /** Every question shown, and the email step, dispatches its documented event. */
  useEffect(() => {
    if (done) return;
    const name = index < total ? events.steps[index] : events.gate;
    if (name) track(name, { step: index + 1, direction: direction.current });
  }, [index, done, events, total]);

  useEffect(() => {
    if (state.status === 'sent' || state.status === 'unsent') {
      track(state.status === 'sent' ? events.result : events.unsent, {
        tier: state.result.tier,
        budgetBand: state.result.budgetBand,
      });
      removeTurnstile();
      resultRef.current?.focus();
    }
    if (state.status === 'error') resetTurnstile();
  }, [state, events, removeTurnstile, resetTurnstile]);

  /** Each step change moves focus to its question, so the change is announced. */
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    questionRef.current?.focus();
  }, [index]);

  const answersJson = JSON.stringify(
    Object.fromEntries(
      steps.map((entry) => {
        const values = chosen[entry.key] ?? [];
        return [entry.key, entry.multiple ? values : (values[0] ?? '')];
      }),
    ),
  );

  const choose = (entry: CalculatorStepView, value: string, checked: boolean) => {
    setMissing(null);
    setChosen((previous) => {
      const current = previous[entry.key] ?? [];
      if (!entry.multiple) return { ...previous, [entry.key]: [value] };
      let next = checked ? [...current, value] : current.filter((item) => item !== value);
      if (entry.exclusiveOption) {
        next =
          checked && value === entry.exclusiveOption
            ? [value]
            : next.filter((item) => item !== entry.exclusiveOption);
      }
      return { ...previous, [entry.key]: next };
    });
  };

  const goTo = (next: number, way: 'next' | 'back') => {
    direction.current = way;
    setMissing(null);
    setIndex(next);
  };

  const onQuestionSubmit: NonNullable<ComponentProps<'form'>['onSubmit']> = (event) => {
    event.preventDefault();
    if (!step) return;
    if ((chosen[step.key] ?? []).length === 0) {
      setMissing(step.multiple ? copy.labels.chooseAtLeastOne : copy.labels.chooseOne);
      optionsRef.current?.querySelector('input')?.focus();
      return;
    }
    goTo(index + 1, 'next');
  };

  const startTurnstile = () => {
    prepareTurnstile().catch(() => undefined);
  };

  /** Holds the first submit until Turnstile has put a token in the form, then submits again. */
  const onGateSubmit: NonNullable<ComponentProps<'form'>['onSubmit']> = (event) => {
    if (attributionRef.current) attributionRef.current.value = JSON.stringify(captureAttribution());
    track(events.submit, { step: total + 1, direction: 'next' });
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
        setCheckProblem(copy.errors.botCheck);
      },
    );
  };

  const restart = () => {
    track(events.restart, { step: 1, direction: 'back' });
    setChosen({});
    direction.current = 'back';
    mounted.current = false;
    setIndex(0);
  };

  if (done) {
    return (
      <Result copy={copy} state={state} events={events} panelRef={resultRef} onRestart={restart} />
    );
  }

  const stepNumber = index + 1;
  const secondsLeft = (total - index) * copy.secondsPerStep;
  const minutes = Math.round(secondsLeft / 60);
  const timeLeft =
    secondsLeft < 45
      ? copy.labels.timeLeftShort
      : minutes <= 1
        ? copy.labels.timeLeftOne
        : fill(copy.labels.timeLeft, { minutes });
  const percent = Math.round((stepNumber / (total + 1)) * 100);
  // The eight questions are numbered; the email step is the last card and says so instead.
  const progressLabel = atGate ? copy.labels.gateProgress : fill(copy.labels.progress, { current: stepNumber, total });
  const alertMessage = checkProblem ?? (state.status === 'error' ? state.message : null);
  const errors = state.status === 'error' ? state.fieldErrors : {};
  const values = state.status === 'error' ? state.values : { name: '', email: '', company: '' };
  const busy = pending || verifying;

  return (
    <div className="rounded-2xl border border-line bg-white p-6 text-ink shadow-panel sm:p-9">
      <div className="flex items-center justify-between gap-4 text-[13.5px]">
        <p className="font-semibold">{progressLabel}</p>
        <p className="text-body">{timeLeft}</p>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-mist"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total + 1}
        aria-valuenow={stepNumber}
        aria-valuetext={`${progressLabel}. ${timeLeft}`}
      >
        <span
          className="block h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${String(percent)}%` }}
        />
      </div>

      {atGate ? (
        <form
          action={formAction}
          onSubmit={onGateSubmit}
          onFocus={startTurnstile}
          onPointerDown={startTurnstile}
          noValidate
          aria-busy={busy}
          className="motion-safe:animate-panel-in"
        >
          <input type="hidden" name="answers" value={answersJson} />
          <input ref={attributionRef} type="hidden" name="attribution" defaultValue="" />
          <div className="absolute left-[-10000px] h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="cost-calculator-reference">Reference code</label>
            <input id="cost-calculator-reference" type="text" name="referenceCode" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>

          <h3 ref={questionRef} tabIndex={-1} className="mt-7 font-display text-[22px] leading-snug font-bold outline-none">
            {copy.gate.heading}
          </h3>
          <p className="mt-3 text-[15.5px] leading-relaxed text-body">{copy.gate.body}</p>

          {alertMessage ? (
            <p role="alert" className="mt-5 text-[14px] font-medium text-danger">
              {alertMessage}
            </p>
          ) : null}

          <div className="mt-6 space-y-5">
            <Field id="cost-calculator-name" label={copy.gate.nameLabel} errors={errors.name}>
              {(control) => <input {...control} type="text" autoComplete="name" aria-required="true" defaultValue={values.name} className={CONTROL} />}
            </Field>
            <Field id="cost-calculator-email" label={copy.gate.emailLabel} errors={errors.email}>
              {(control) => (
                <input {...control} type="email" autoComplete="email" aria-required="true" defaultValue={values.email} placeholder="you@company.com" className={CONTROL} />
              )}
            </Field>
            <Field id="cost-calculator-company" label={copy.gate.companyLabel} errors={errors.company}>
              {(control) => <input {...control} type="text" autoComplete="organization" defaultValue={values.company} className={CONTROL} />}
            </Field>
          </div>

          <div ref={turnstileContainerRef} className="mt-5 empty:hidden" />

          <p className="mt-5 text-[13.5px] leading-relaxed text-body">
            {copy.gate.privacy}{' '}
            <a href={copy.gate.privacyLink.href} className="font-semibold text-primary underline underline-offset-4 hover:text-primaryd">
              {copy.gate.privacyLink.label}
            </a>
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" onClick={() => { goTo(index - 1, 'back'); }} className={QUIET_BUTTON}>
              {copy.labels.back}
            </button>
            <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
              {busy ? copy.gate.sendingLabel : copy.gate.submitLabel}
            </button>
          </div>
        </form>
      ) : step ? (
        <form onSubmit={onQuestionSubmit} className="motion-safe:animate-panel-in">
          <fieldset ref={optionsRef} aria-describedby={missing ? 'cost-calculator-missing' : undefined}>
            <legend className="mt-7 w-full">
              <h3 ref={questionRef} tabIndex={-1} className="font-display text-[22px] leading-snug font-bold outline-none">
                {step.question}
              </h3>
            </legend>
            {step.help ? <p className="mt-3 text-[15px] leading-relaxed text-body">{step.help}</p> : null}
            <ul className="mt-6 space-y-3">
              {step.options.map((option) => {
                const selected = (chosen[step.key] ?? []).includes(option.value);
                return (
                  <li key={option.value}>
                    <label
                      className={`flex cursor-pointer items-start gap-3.5 rounded-xl border px-5 py-3.5 text-[15.5px] has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${selected ? 'border-2 border-primary bg-primary/5 px-[19px] py-[13px] font-semibold' : 'border-line hover:border-ink'}`}
                    >
                      <input
                        type={step.multiple ? 'checkbox' : 'radio'}
                        name={step.key}
                        value={option.value}
                        checked={selected}
                        aria-invalid={missing ? true : undefined}
                        onChange={(event) => { choose(step, option.value, event.currentTarget.checked); }}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`mt-1 h-4 w-4 shrink-0 border-2 ${step.multiple ? 'rounded-sm' : 'rounded-full'} ${selected ? 'border-[5px] border-primary' : 'border-line'}`}
                      />
                      <span className="min-h-6">
                        {option.label}
                        {option.description ? (
                          <span className="mt-1 block text-[14px] leading-relaxed font-normal text-body">{option.description}</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {missing ? (
            <p id="cost-calculator-missing" role="alert" className="mt-4 text-[14px] font-medium text-danger">
              {missing}
            </p>
          ) : null}

          <div className="mt-7 flex flex-wrap gap-3">
            {index > 0 ? (
              <button type="button" onClick={() => { goTo(index - 1, 'back'); }} className={QUIET_BUTTON}>
                {copy.labels.back}
              </button>
            ) : null}
            <button type="submit" className={PRIMARY_BUTTON}>
              {index === total - 1 ? copy.labels.toResult : copy.labels.next}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Field({
  id,
  label,
  errors,
  children,
}: {
  id: string;
  label: string;
  errors: string[] | undefined;
  children: (control: { id: string; name: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode;
}) {
  const name = id.replace('cost-calculator-', '');
  const message = errors?.[0];
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold text-ink">
        {label}
      </label>
      {children({ id, name, ...(message ? { 'aria-invalid': true, 'aria-describedby': errorId } : {}) })}
      {message ? (
        <p id={errorId} className="mt-1.5 text-[13px] font-medium text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function Result({
  copy,
  state,
  events,
  panelRef,
  onRestart,
}: {
  copy: CalculatorViewProps['copy'];
  state: Extract<CalculatorFormState, { status: 'sent' | 'unsent' }>;
  events: CalculatorViewProps['events'];
  panelRef: RefObject<HTMLDivElement | null>;
  onRestart: () => void;
}) {
  const { result } = state;
  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="status"
      data-calculator-result=""
      className="rounded-2xl border border-line bg-white p-6 text-ink shadow-panel outline-none sm:p-9"
    >
      <h3 className="font-display text-[22px] leading-snug font-bold">{copy.result.heading}</h3>
      <p
        className={`mt-4 text-[14.5px] leading-relaxed ${state.status === 'unsent' ? 'border-l-4 border-danger pl-4 text-ink' : 'text-body'}`}
      >
        {state.note}
      </p>

      <p className="mt-6 text-[13px] font-semibold tracking-[0.06em] text-body uppercase">{copy.result.rangeHeading}</p>
      <p className="mt-1 font-display text-[34px] leading-none font-extrabold lg:text-[42px]">{result.rangeLabel}</p>
      <p className="mt-4 text-[15.5px] leading-relaxed">
        <b>{result.tierName}</b>
        {`. ${result.tierSummary}`}
      </p>

      <h4 className="mt-9 font-display text-[17px] font-bold">{copy.result.breakdownHeading}</h4>
      <dl className="mt-4 divide-y divide-line border-y border-line">
        {result.breakdown.map((row) => (
          <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
            <dt className="text-[15px]">
              {row.label}
              {row.detail ? <span className="block text-[13.5px] text-body">{row.detail}</span> : null}
            </dt>
            <dd className="text-[15px] font-semibold">{row.value}</dd>
          </div>
        ))}
      </dl>

      <h4 className="mt-9 font-display text-[17px] font-bold">{copy.result.moversHeading}</h4>
      {result.movers.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {result.movers.map((row) => (
            <li key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-[15px]">
              <span>{row.label}</span>
              <span className="font-semibold">{row.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[15px] leading-relaxed text-body">{result.noMovers}</p>
      )}

      <h4 className="mt-9 font-display text-[17px] font-bold">{copy.result.monthlyHeading}</h4>
      <p className="mt-3 text-[15px] leading-relaxed">{result.monthly}</p>

      <details className="mt-9 border-t border-line pt-5">
        <summary className="cursor-pointer font-display text-[17px] font-bold">{copy.result.answersHeading}</summary>
        <dl className="mt-4 space-y-2">
          {result.answers.map((row) => (
            <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-6 text-[15px]">
              <dt className="text-body">{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </details>

      <div className="mt-9 rounded-xl bg-mist2 p-6">
        <h4 className="font-display text-[19px] font-bold">{copy.result.bookHeading}</h4>
        <p className="mt-2.5 text-[15px] leading-relaxed">{copy.result.bookBody}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={result.bookingPath}
            onClick={() => { track(events.book, { tier: result.tier, budgetBand: result.budgetBand }); }}
            className={PRIMARY_BUTTON}
          >
            {copy.result.bookLabel}
          </a>
          <button type="button" onClick={onRestart} className={QUIET_BUTTON}>
            {copy.labels.restart}
          </button>
        </div>
      </div>

      <p className="mt-6 text-[13.5px] leading-relaxed text-body">{copy.result.note}</p>
    </div>
  );
}
