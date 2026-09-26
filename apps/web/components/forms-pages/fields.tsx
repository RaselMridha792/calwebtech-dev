import type { FormsField } from '@calwebtech/shared';

/*
 * The controls the forms family's two forms share: a labelled input, a labelled textarea and
 * a list of choices, each with its hint or its error under it and wired to it with
 * `aria-describedby`. Server-renderable and free of state, so both client forms import them.
 */

export interface FormOption {
  value: string;
  label: string;
}

const inputClass =
  'body-base mt-2 h-12 w-full border border-hairline bg-canvas-raised px-4 text-ink outline-none placeholder:text-ink-muted/60 focus-visible:border-gold-ink aria-invalid:border-danger';

const areaClass =
  'body-base mt-2 w-full border border-hairline bg-canvas-raised px-4 py-3 text-ink outline-none placeholder:text-ink-muted/60 focus-visible:border-gold-ink aria-invalid:border-danger';

const choiceClass =
  'flex min-h-11 cursor-pointer items-center gap-3 border border-hairline px-4 py-2.5 text-[15px] text-ink hover:border-hairline-strong has-checked:border-gold-ink has-checked:font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus';

function Hint({ id, hint, error }: { id: string; hint: string | null; error: string | undefined }) {
  if (error) {
    return (
      <p id={`${id}-note`} className="mt-1.5 text-[13px] font-medium text-danger">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={`${id}-note`} className="body-sm mt-1.5 text-ink-muted">
      {hint}
    </p>
  ) : null;
}

function Label({ id, copy, required }: { id: string; copy: FormsField; required: boolean }) {
  return (
    // `self-end`: in a row of fields a short label sits on its input, not at the top of a row a
    // longer neighbour made two lines tall.
    <label htmlFor={id} className="eyebrow self-end text-ink-muted">
      {copy.label}
      {required ? null : <span className="ms-2 tracking-normal normal-case">(optional)</span>}
    </label>
  );
}

/**
 * A field's label, control and note share three rows with the field beside it (`subgrid`), so a
 * label that wraps to two lines moves its neighbour's input down too and a row of inputs stays
 * level. Spacing between fields is the field's own bottom padding; the grid has no row gap.
 */
const FIELD_ROWS = 'row-span-3 grid grid-rows-subgrid pb-5';

export function Field({
  idPrefix,
  name,
  copy,
  type = 'text',
  required = false,
  autoComplete,
  minLength,
  error,
}: {
  /** Keeps ids unique between forms: `brief-email`, `audit-email`. */
  idPrefix: string;
  name: string;
  copy: FormsField;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  error: string | undefined;
}) {
  const id = `${idPrefix}-${name}`;
  return (
    <div className={FIELD_ROWS}>
      <Label id={id} copy={copy} required={required} />
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={copy.placeholder ?? undefined}
        aria-describedby={error || copy.hint ? `${id}-note` : undefined}
        {...(error ? { 'aria-invalid': true } : {})}
        className={inputClass}
      />
      <Hint id={id} hint={copy.hint} error={error} />
    </div>
  );
}

export function Area({
  idPrefix,
  name,
  copy,
  rows,
  error,
}: {
  idPrefix: string;
  name: string;
  copy: FormsField;
  rows: number;
  error: string | undefined;
}) {
  const id = `${idPrefix}-${name}`;
  return (
    <div>
      <Label id={id} copy={copy} required={false} />
      <textarea
        id={id}
        name={name}
        rows={rows}
        placeholder={copy.placeholder ?? undefined}
        aria-describedby={error || copy.hint ? `${id}-note` : undefined}
        {...(error ? { 'aria-invalid': true } : {})}
        className={areaClass}
      />
      <Hint id={id} hint={copy.hint} error={error} />
    </div>
  );
}

/**
 * One answer from a list (radios), or several (checkboxes). With `legend` the list is a
 * fieldset whose legend asks the question; without it, inside a step whose own legend already
 * asks it, the group only repeats the field's name for anyone navigating by form controls.
 */
export function Choices({
  name,
  options,
  label,
  legend = false,
  multiple = false,
  error,
}: {
  name: string;
  options: readonly FormOption[];
  label: string;
  legend?: boolean;
  multiple?: boolean;
  error: string | undefined;
}) {
  const list = (
    <>
      <ul className={`grid gap-3 sm:grid-cols-2${legend ? ' mt-2' : ''}`}>
        {options.map((option) => (
          <li key={option.value}>
            <label className={choiceClass}>
              <input type={multiple ? 'checkbox' : 'radio'} name={name} value={option.value} className="size-4 shrink-0 accent-navy-900" />
              {option.label}
            </label>
          </li>
        ))}
      </ul>
      {error ? <p className="mt-2 text-[13px] font-medium text-danger">{error}</p> : null}
    </>
  );
  if (legend) {
    return (
      <fieldset className="min-w-0">
        <legend className="eyebrow text-ink-muted">{label}</legend>
        {list}
      </fieldset>
    );
  }
  return (
    <div role="group" aria-label={label}>
      {list}
    </div>
  );
}
