'use client';

import type { LeadType } from '@calwebtech/shared';
import { useActionState, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { captureAttribution } from '@/lib/attribution-client';
import { submitLead, type LeadFormState } from '@/lib/lead-actions';
import { ShieldIcon } from '../ui/icons';
import { TURNSTILE_FIELD, useTurnstile } from './use-turnstile';
import { FormClock } from './form-clock';

interface Option {
  value: string;
  label: string;
}

export interface LeadFormProps {
  variant: 'hero' | 'full';
  formId: string;
  /** Which kind of lead the form creates. */
  leadType?: LeadType;
  /** Campaign page the lead is attributed to, when the form sits on one. */
  landingPageSlug?: string;
  /** Service page the enquiry comes from; the API links the lead to the service. */
  serviceSlug?: string;
  /** The second field beside the company in the full form. */
  contactField?: 'siteUrl' | 'phone';
  /** "How did you find us?" options; the question is left out when there are none. */
  referralOptions?: readonly string[];
  /** Page URL, so the form still works before hydration or without script. */
  permalink: string;
  submitLabel: string;
  success: { heading: string; body: string };
  budgetOptions: readonly Option[];
  timelineOptions?: readonly Option[];
  serviceOptions?: readonly string[];
  /** Routed enquiry types, asked first in the full form and posted as `enquiryType`. Left out when there are none. */
  enquiry?: { label: string; options: readonly Option[]; defaultValue?: string };
  /** The free-text question, where the default does not fit the form. */
  message?: { label: string; placeholder: string };
  /** Where the visitor goes once the lead is stored, e.g. `/thank-you/contact/`. Without script the success message shows in place. */
  thankYouPath?: string;
  assurances?: readonly string[];
  footnote?: string;
  className?: string;
  /** Cloudflare Turnstile site key. Without one the form posts no token and the API refuses it. */
  turnstileSiteKey?: string;
}

const CHECK_PROBLEM =
  'We could not run the security check. Check your connection and try again, or call us.';

const initialState: LeadFormState = { status: 'idle' };

function writeAttribution(input: HTMLInputElement | null): void {
  if (input) input.value = JSON.stringify(captureAttribution());
}

const controlClass =
  'w-full  border border-hairline bg-canvas-raised text-ink placeholder:text-ink-muted/60 focus:border-gold-ink aria-invalid:border-danger';

interface FieldProps {
  formId: string;
  name: string;
  label: ReactNode;
  errors: string[] | undefined;
  labelClass: string;
  children: (control: {
    id: string;
    name: string;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
  }) => ReactNode;
}

function Field({ formId, name, label, errors, labelClass, children }: FieldProps) {
  const id = `${formId}-${name}`;
  const errorId = `${id}-error`;
  const message = errors?.[0];
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children({
        id,
        name,
        ...(message ? { 'aria-invalid': true, 'aria-describedby': errorId } : {}),
      })}
      {message ? (
        <p id={errorId} className="mt-1.5 text-[13px] font-medium text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Public lead form. Posts to a server action that forwards to the API, so
 * validation and storage rules live in one place.
 */
export function LeadForm(props: LeadFormProps) {
  const { variant, formId, success, thankYouPath } = props;
  const [state, formAction, pending] = useActionState(submitLead, initialState, props.permalink);
  const attributionRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const {
    containerRef: turnstileContainerRef,
    prepare: prepareTurnstile,
    waitForToken,
    remove: removeTurnstile,
    reset: resetTurnstile,
  } = useTurnstile(props.turnstileSiteKey, formId);
  const [verifying, setVerifying] = useState(false);
  const [checkProblem, setCheckProblem] = useState<string | null>(null);

  const startTurnstile = () => {
    // Problems surface on submit, where the visitor can act on them.
    prepareTurnstile().catch(() => undefined);
  };

  /**
   * Holds the first submit until Turnstile has put a token in the form, then submits
   * again. The second submit finds the token and goes to the server action.
   */
  const handleSubmit: NonNullable<ComponentProps<'form'>['onSubmit']> = (event) => {
    writeAttribution(attributionRef.current);
    if (!props.turnstileSiteKey) return;
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
      if (thankYouPath) window.location.assign(thankYouPath);
    }
    if (state.status === 'error') {
      resetTurnstile();
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state, removeTurnstile, resetTurnstile, thankYouPath]);

  if (state.status === 'success') {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className={variant === 'hero' ? 'p-7' : props.className}
      >
        <p className="font-display text-[22px] font-extrabold text-ink">{success.heading}</p>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-muted">{success.body}</p>
      </div>
    );
  }

  const alertMessage = checkProblem ?? (state.status === 'error' ? state.message : null);
  const busy = pending || verifying;
  const errors = state.status === 'error' ? state.fieldErrors : {};
  const values = state.status === 'error' ? state.values : {};
  const value = (name: string) => {
    const current = values[name];
    return typeof current === 'string' ? current : undefined;
  };
  const chosenServices = Array.isArray(values.serviceInterest) ? values.serviceInterest : [];

  const hero = variant === 'hero';
  const labelClass = hero
    ? 'mb-1.5 block text-[13.5px] font-semibold'
    : 'mb-1.5 block text-[14px] font-semibold text-ink';
  const field = (name: string, label: ReactNode, control: FieldProps['children']) => (
    <Field
      formId={formId}
      name={name}
      label={label}
      errors={errors[name]}
      labelClass={labelClass}
    >
      {control}
    </Field>
  );

  const nameField = field('name', 'Full name', (c) => (
    <input {...c} type="text" autoComplete="name" aria-required="true" defaultValue={value('name')} className={`${controlClass} h-12 px-4`} />
  ));
  const emailField = field('email', 'Work email', (c) => (
    <input {...c} type="email" autoComplete="email" aria-required="true" defaultValue={value('email')} placeholder="you@company.com" className={`${controlClass} h-12 px-4`} />
  ));
  const companyField = field('company', 'Company', (c) => (
    <input {...c} type="text" autoComplete="organization" defaultValue={value('company')} className={`${controlClass} h-12 px-4`} />
  ));
  const budgetField = field('budgetBand', 'Budget range', (c) => (
    <select {...c} defaultValue={value('budgetBand') ?? ''} className={`${controlClass} h-12 px-4`}>
      <option value="">Choose a range</option>
      {props.budgetOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ));
  const phoneField = field('phone', 'Phone', (c) => (
    <input {...c} type="tel" autoComplete="tel" defaultValue={value('phone')} placeholder="Optional" className={`${controlClass} h-12 px-4`} />
  ));
  const timelineOptions = props.timelineOptions ?? [];
  const referralOptions = props.referralOptions ?? [];
  const messageField = field('message', props.message?.label ?? 'What is going wrong right now?', (c) => (
    <textarea {...c} rows={hero ? 3 : 4} defaultValue={value('message')} placeholder={props.message?.placeholder ?? 'Two or three sentences is plenty.'} className={`${controlClass} resize-none p-4`} />
  ));
  const enquiry = props.enquiry && props.enquiry.options.length > 0 ? props.enquiry : null;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      onFocus={startTurnstile}
      onPointerDown={startTurnstile}
      noValidate
      aria-busy={busy}
      className={hero ? 'space-y-4 p-7' : props.className}
    >
      <input type="hidden" name="type" value={props.leadType ?? 'PROJECT'} />
      <input type="hidden" name="formId" value={formId} />
      {props.landingPageSlug ? <input type="hidden" name="landingPageSlug" value={props.landingPageSlug} /> : null}
      {props.serviceSlug ? <input type="hidden" name="serviceSlug" value={props.serviceSlug} /> : null}
      <input ref={attributionRef} type="hidden" name="attribution" defaultValue="" />
      <div className="absolute left-[-10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={`${formId}-reference`}>Reference code</label>
        <input id={`${formId}-reference`} type="text" name="referenceCode" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <FormClock />

      {alertMessage ? (
        <p role="alert" className="text-[14px] font-medium text-danger">
          {alertMessage}
        </p>
      ) : null}

      {hero ? (
        <>
          {nameField}
          {emailField}
          <div className="grid grid-cols-2 gap-4">
            {companyField}
            {phoneField}
          </div>
          {props.budgetOptions.length > 0 ? budgetField : null}
          {messageField}
        </>
      ) : (
        <>
          {enquiry ? (
            <div className="mb-5">
              {field('enquiryType', enquiry.label, (c) => (
                <select {...c} defaultValue={value('enquiryType') ?? enquiry.defaultValue ?? enquiry.options[0]?.value} className={`${controlClass} h-12 px-4`}>
                  {enquiry.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            {nameField}
            {companyField}
            {emailField}
            {props.contactField === 'phone'
              ? phoneField
              : field('siteUrl', 'Current website', (c) => (
                  <input {...c} type="text" inputMode="url" autoComplete="url" defaultValue={value('siteUrl')} placeholder="company.com" className={`${controlClass} h-12 px-4`} />
                ))}
          </div>

          {props.serviceOptions && props.serviceOptions.length > 0 ? (
            <fieldset className="mt-6">
              <legend className="mb-2.5 block text-[14px] font-semibold text-ink">What do you need?</legend>
              <div className="flex flex-wrap gap-2">
                {props.serviceOptions.map((option) => (
                  <label
                    key={option}
                    className="inline-flex h-10 cursor-pointer items-center border border-hairline px-4 text-[14px] hover:border-ink has-checked:border-gold-ink has-checked:bg-navy-500/5 has-checked:font-semibold has-checked:text-ink has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
                  >
                    <input
                      type="checkbox"
                      name="serviceInterest"
                      value={option}
                      defaultChecked={chosenServices.includes(option)}
                      className="sr-only"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="mt-6 grid gap-5 empty:hidden sm:grid-cols-2">
            {props.budgetOptions.length > 0 ? budgetField : null}
            {timelineOptions.length > 0
              ? field('timeline', 'When do you want to start?', (c) => (
                  <select {...c} defaultValue={value('timeline') ?? ''} className={`${controlClass} h-12 px-4`}>
                    <option value="">Choose a timeframe</option>
                    {timelineOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ))
              : null}
            {referralOptions.length > 0
              ? field('referralSource', 'How did you find us?', (c) => (
                  <select {...c} defaultValue={value('referralSource') ?? ''} className={`${controlClass} h-12 px-4`}>
                    <option value="">Choose one</option>
                    {referralOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ))
              : null}
          </div>

          <div className="mt-6">{messageField}</div>
        </>
      )}

      {/* Turnstile renders here, and stays invisible unless it needs the visitor. */}
      <div ref={turnstileContainerRef} className="empty:hidden" />

      <button
        type="submit"
        disabled={busy}
        className={
          hero
            ? 'h-14 w-full  bg-navy-900 text-[16px] font-semibold text-ink-invert  hover:bg-navy-700 disabled:opacity-70'
            : 'mt-7 inline-flex h-14 w-full items-center justify-center  bg-navy-900 px-8 text-[16px] font-semibold text-ink-invert hover:bg-navy-700 disabled:opacity-70 sm:w-auto'
        }
      >
        {busy ? 'Sending…' : props.submitLabel}
      </button>

      {hero && props.assurances && props.assurances.length > 0 ? (
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-1 text-[12.5px] text-ink-muted">
          {props.assurances.map((assurance, index) => (
            <li key={assurance} className="flex items-center gap-1.5">
              {index === 0 ? <ShieldIcon className="h-3.5 w-3.5" /> : null}
              {assurance}
            </li>
          ))}
        </ul>
      ) : null}

      {props.footnote ? <p className="mt-4 text-[13px]">{props.footnote}</p> : null}
    </form>
  );
}
