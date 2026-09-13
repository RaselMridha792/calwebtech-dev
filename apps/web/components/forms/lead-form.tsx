'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { captureAttribution } from '@/lib/attribution-client';
import { submitLead, type LeadFormState } from '@/lib/lead-actions';
import { ShieldIcon } from '../ui/icons';

interface Option {
  value: string;
  label: string;
}

export interface LeadFormProps {
  variant: 'hero' | 'full';
  formId: string;
  landingPageSlug: string;
  /** Page URL, so the form still works before hydration or without script. */
  permalink: string;
  submitLabel: string;
  success: { heading: string; body: string };
  budgetOptions: readonly Option[];
  timelineOptions?: readonly Option[];
  serviceOptions?: readonly string[];
  assurances?: readonly string[];
  footnote?: string;
  className?: string;
}

const initialState: LeadFormState = { status: 'idle' };

function writeAttribution(input: HTMLInputElement | null): void {
  if (input) input.value = JSON.stringify(captureAttribution());
}

const controlClass =
  'w-full rounded-lg border border-line bg-white text-ink placeholder:text-body/60 focus:border-primary aria-invalid:border-danger';

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
  const { variant, formId, success } = props;
  const [state, formAction, pending] = useActionState(submitLead, initialState, props.permalink);
  const attributionRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const recordAttribution = () => {
    writeAttribution(attributionRef.current);
  };

  useEffect(() => {
    writeAttribution(attributionRef.current);
  }, []);

  useEffect(() => {
    if (state.status === 'success') successRef.current?.focus();
    if (state.status === 'error') {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  if (state.status === 'success') {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className={variant === 'hero' ? 'p-7' : props.className}
      >
        <p className="font-display text-[22px] font-extrabold text-ink">{success.heading}</p>
        <p className="mt-3 text-[15.5px] leading-relaxed text-body">{success.body}</p>
      </div>
    );
  }

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
  const messageField = field('message', 'What is going wrong right now?', (c) => (
    <textarea {...c} rows={hero ? 3 : 4} defaultValue={value('message')} placeholder="Two or three sentences is plenty." className={`${controlClass} resize-none p-4`} />
  ));

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={recordAttribution}
      noValidate
      aria-busy={pending}
      className={hero ? 'space-y-4 p-7' : props.className}
    >
      <input type="hidden" name="type" value="PROJECT" />
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="landingPageSlug" value={props.landingPageSlug} />
      <input ref={attributionRef} type="hidden" name="attribution" defaultValue="" />
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={`${formId}-reference`}>Reference code</label>
        <input id={`${formId}-reference`} type="text" name="referenceCode" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {state.status === 'error' ? (
        <p role="alert" className="text-[14px] font-medium text-danger">
          {state.message}
        </p>
      ) : null}

      {hero ? (
        <>
          {nameField}
          {emailField}
          <div className="grid grid-cols-2 gap-4">
            {companyField}
            {field('phone', 'Phone', (c) => (
              <input {...c} type="tel" autoComplete="tel" defaultValue={value('phone')} placeholder="Optional" className={`${controlClass} h-12 px-4`} />
            ))}
          </div>
          {budgetField}
          {messageField}
        </>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            {nameField}
            {companyField}
            {emailField}
            {field('siteUrl', 'Current website', (c) => (
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
                    className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-line px-4 text-[14px] hover:border-ink has-checked:border-primary has-checked:bg-primary/5 has-checked:font-semibold has-checked:text-ink has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
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

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {budgetField}
            {field('timeline', 'When do you want to start?', (c) => (
              <select {...c} defaultValue={value('timeline') ?? ''} className={`${controlClass} h-12 px-4`}>
                <option value="">Choose a timeframe</option>
                {(props.timelineOptions ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ))}
          </div>

          <div className="mt-6">{messageField}</div>
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        className={
          hero
            ? 'h-14 w-full rounded-xl bg-primary text-[16px] font-semibold text-white shadow-cta hover:bg-primaryd disabled:opacity-70'
            : 'mt-7 inline-flex h-14 w-full items-center justify-center rounded-xl bg-primary px-8 text-[16px] font-semibold text-white hover:bg-primaryd disabled:opacity-70 sm:w-auto'
        }
      >
        {pending ? 'Sending…' : props.submitLabel}
      </button>

      {hero && props.assurances && props.assurances.length > 0 ? (
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-1 text-[12.5px] text-body">
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
