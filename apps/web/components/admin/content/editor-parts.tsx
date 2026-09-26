'use client';
import { useId, type ReactNode } from 'react';
import {
  CARD,
  CARD_PAD,
  ERROR,
  H2,
  HELP,
  INPUT as KIT_INPUT,
  LABEL as KIT_LABEL,
  PILL,
  TEXTAREA,
  button,
} from '@/components/admin/ui/styles';

/*
 * The controls every content editor in the dashboard is built from: a card-like section,
 * a labelled input, a textarea, the help or error line under them, an action button and
 * the status pill. Shared so the service, industry and case study editors and the page
 * copy editor read and behave alike, and all of them draw from the kit in
 * `components/admin/ui/styles` so a form here matches a form anywhere else in the admin.
 */

export const LABEL = KIT_LABEL;
export const INPUT = KIT_INPUT;

/** A group of related fields: a card with its heading and one line on what it is for. */
export function Section({ heading, help, children }: { heading: string; help?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`${CARD} ${CARD_PAD} flex min-w-0 flex-col gap-5`}>
      <div className="flex flex-col gap-1">
        <h2 id={id} className={H2}>
          {heading}
        </h2>
        {help ? <p className="text-[13.5px] leading-[1.55] text-ink-invert-muted">{help}</p> : null}
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
  const input = (
    <input
      id={id}
      type={type}
      value={value}
      aria-invalid={errors ? true : undefined}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      className={`${INPUT} ${prefix ? 'min-w-0 rounded-l-none' : ''}`}
    />
  );
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${narrow ? 'w-full sm:w-35' : ''}`}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {prefix ? (
        <span className="flex min-w-0">
          <span className="inline-flex h-10 shrink-0 items-center rounded-l-lg border border-r-0 border-admin-line bg-admin-hover px-3 text-[14px] text-admin-muted pointer-coarse:h-11">
            {prefix}
          </span>
          {input}
        </span>
      ) : (
        input
      )}
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
    <div className="flex min-w-0 flex-col gap-1.5">
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
        className={TEXTAREA}
      />
      <Help errors={errors} help={help} />
    </div>
  );
}

export function Help({ errors, help }: { errors?: string[]; help?: string }) {
  if (errors?.length) {
    return (
      <p role="alert" className={ERROR}>
        {errors.join(' ')}
      </p>
    );
  }
  return help ? <p className={HELP}>{help}</p> : null;
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
    <button type="button" disabled={busy} onClick={onClick} className={button(primary ? 'primary' : 'secondary')}>
      {busy ? 'Working…' : children}
    </button>
  );
}

/**
 * A record's publishing state as a pill with a dot. Teal is a round affirmative mark and
 * nothing else (the calwebtech/teal-usage rule), so only "published" gets it; a draft is a
 * ring, a scheduled one is gold, and an archived one is grey.
 */
const DOT: Record<string, string> = {
  PUBLISHED: 'rounded-full bg-result',
  SCHEDULED: 'rounded-full bg-gold-500',
  DRAFT: 'rounded-full bg-admin-surface ring-2 ring-admin-muted ring-inset',
  ARCHIVED: 'rounded-full bg-admin-muted',
};

export function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span className={`${PILL} pl-2`}>
      <span aria-hidden className={`size-2 shrink-0 ${DOT[status] ?? 'rounded-full bg-admin-muted'}`} />
      {label}
    </span>
  );
}
