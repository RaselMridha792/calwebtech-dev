'use client';
import type { ReactNode } from 'react';

/*
 * The controls every content editor in the dashboard is built from: a labelled section, an
 * input, a textarea, the help or error line under them, and an action button. Shared so the
 * service, industry and case study editors and the page copy editor read and behave alike.
 */

export const LABEL = 'text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase';
export const INPUT =
  'h-[30px] w-full rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus';

export function Section({ heading, help, children }: { heading: string; help?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-admin-line pt-4">
      <div>
        <h2 className="text-[10px] font-bold tracking-[0.14em] text-admin-muted uppercase">{heading}</h2>
        {help ? <p className="mt-1 text-[11.5px] text-admin-body">{help}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  id,
  value,
  onChange,
  errors,
  help,
  prefix,
  type = 'text',
  narrow,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
  help?: string;
  prefix?: string;
  type?: string;
  narrow?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-[3px] ${narrow ? 'w-[110px]' : ''}`}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <span className="flex items-center gap-1.5">
        {prefix ? <span className="text-[12px] text-admin-muted">{prefix}</span> : null}
        <input
          id={id}
          type={type}
          value={value}
          aria-invalid={errors ? true : undefined}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className={`${INPUT} ${errors ? 'border-danger' : ''}`}
        />
      </span>
      <Help errors={errors} help={help} />
    </div>
  );
}

export function Area({
  label,
  id,
  value,
  onChange,
  rows,
  errors,
  help,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  errors?: string[];
  help?: string;
}) {
  return (
    <div className="flex flex-col gap-[3px]">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        aria-invalid={errors ? true : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={`w-full rounded-[4px] border bg-admin-surface px-2 py-1.5 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus ${
          errors ? 'border-danger' : 'border-admin-line'
        }`}
      />
      <Help errors={errors} help={help} />
    </div>
  );
}

export function Help({ errors, help }: { errors?: string[]; help?: string }) {
  if (errors?.length) {
    return (
      <p role="alert" className="text-[11px] text-danger">
        {errors.join(' ')}
      </p>
    );
  }
  return help ? <p className="text-[11px] text-admin-muted">{help}</p> : null;
}

export function Action({
  busy,
  primary,
  onClick,
  children,
}: {
  busy: boolean;
  primary?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`h-[30px] rounded-[4px] px-3 text-[12px] font-semibold disabled:opacity-40 ${
        primary
          ? 'bg-primary text-white hover:bg-admin-primaryh'
          : 'border border-admin-line text-admin-body hover:border-admin-focus hover:text-admin-ink'
      }`}
    >
      {busy ? 'Working…' : children}
    </button>
  );
}
