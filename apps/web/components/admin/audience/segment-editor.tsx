'use client';
import type { AdminSegment, SegmentCondition, SegmentField, SegmentPreview, SegmentRules } from '@calwebtech/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { describeRules } from './describe-rules';

/**
 * The segment builder (docs/12-admin-dashboard.md, module 4).
 *
 * The count below the rules is live: every change asks the API, a moment after the typing
 * stops, how many subscribers the rules reach now. It is the API's count, not one worked out
 * here, so it already leaves out the suppression list and unsubscribes and cannot disagree
 * with what a send would reach.
 *
 * Types come from the shared package with `import type` only, so no schema or zod reaches
 * this bundle; the API validates what is saved.
 */

interface OpChoice {
  op: string;
  label: string;
}

interface FieldChoice {
  field: SegmentField;
  label: string;
  ops: OpChoice[];
  /** Whether the condition takes a number of days rather than a piece of text. */
  takes: 'value' | 'days';
  placeholder?: string;
}

const FIELDS: FieldChoice[] = [
  {
    field: 'tag',
    label: 'Tag',
    takes: 'value',
    placeholder: 'newsletter',
    ops: [
      { op: 'has', label: 'has the tag' },
      { op: 'lacks', label: 'does not have the tag' },
    ],
  },
  {
    field: 'sourcePage',
    label: 'Signed up on',
    takes: 'value',
    placeholder: '/insights/',
    ops: [
      { op: 'is', label: 'the page' },
      { op: 'contains', label: 'a page containing' },
    ],
  },
  {
    field: 'emailDomain',
    label: 'Email domain',
    takes: 'value',
    placeholder: 'example.com',
    ops: [
      { op: 'is', label: 'is' },
      { op: 'isNot', label: 'is not' },
    ],
  },
  {
    field: 'subscribed',
    label: 'Joined',
    takes: 'days',
    ops: [
      { op: 'withinDays', label: 'in the last (days)' },
      { op: 'beforeDays', label: 'more than this many days ago' },
    ],
  },
  {
    field: 'engaged',
    label: 'Last engaged',
    takes: 'days',
    ops: [
      { op: 'withinDays', label: 'in the last (days)' },
      { op: 'notWithinDays', label: 'not in the last (days)' },
    ],
  },
];

interface DraftCondition {
  key: number;
  field: SegmentField;
  op: string;
  value: string;
  days: string;
}

function choiceFor(field: SegmentField): FieldChoice {
  return FIELDS.find((choice) => choice.field === field) ?? FIELDS[0] ?? { field, label: field, takes: 'value', ops: [] };
}

function toDraft(condition: SegmentCondition, key: number): DraftCondition {
  return {
    key,
    field: condition.field,
    op: condition.op,
    value: 'value' in condition ? condition.value : '',
    days: 'days' in condition ? String(condition.days) : '30',
  };
}

/**
 * A draft as the API's condition, or null while it is not finished. The API checks the
 * rest; this only has to produce the right shape for each field.
 */
function toCondition(draft: DraftCondition): SegmentCondition | null {
  const value = draft.value.trim();
  const days = Number(draft.days);
  const hasDays = Number.isInteger(days) && days > 0;
  switch (draft.field) {
    case 'tag':
      if (!value || (draft.op !== 'has' && draft.op !== 'lacks')) return null;
      return { field: 'tag', op: draft.op, value };
    case 'sourcePage':
      if (!value || (draft.op !== 'is' && draft.op !== 'contains')) return null;
      return { field: 'sourcePage', op: draft.op, value };
    case 'emailDomain':
      if (!value || (draft.op !== 'is' && draft.op !== 'isNot')) return null;
      return { field: 'emailDomain', op: draft.op, value };
    case 'subscribed':
      if (!hasDays || (draft.op !== 'withinDays' && draft.op !== 'beforeDays')) return null;
      return { field: 'subscribed', op: draft.op, days };
    case 'engaged':
      if (!hasDays || (draft.op !== 'withinDays' && draft.op !== 'notWithinDays')) return null;
      return { field: 'engaged', op: draft.op, days };
  }
}

const LABEL = 'text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase';
const INPUT =
  'h-[30px] w-full rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus disabled:opacity-60';

export function SegmentEditor({
  segment,
  knownTags,
  mayWrite,
}: {
  segment: AdminSegment | null;
  knownTags: string[];
  mayWrite: boolean;
}) {
  const router = useRouter();
  const nextKey = useRef(segment?.rules.conditions.length ?? 0);
  const [name, setName] = useState(segment?.name ?? '');
  const [description, setDescription] = useState(segment?.description ?? '');
  const [match, setMatch] = useState<SegmentRules['match']>(segment?.rules.match ?? 'all');
  const [conditions, setConditions] = useState<DraftCondition[]>(
    segment?.rules.conditions.map((condition, index) => toDraft(condition, index)) ?? [],
  );
  const [preview, setPreview] = useState<SegmentPreview | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saved, setSaved] = useState(false);

  const finished = conditions.map(toCondition);
  const complete = finished.every((condition) => condition !== null);
  const rules: SegmentRules = {
    match,
    conditions: finished.filter((condition): condition is SegmentCondition => condition !== null),
  };
  const rulesKey = JSON.stringify(rules);

  // The live count, a moment after the last change.
  useEffect(() => {
    if (!complete) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPreviewState('loading');
      adminMutate<SegmentPreview>('/admin/segments/preview', { method: 'POST', body: { rules: JSON.parse(rulesKey) as unknown } })
        .then((result) => {
          if (cancelled) return;
          setPreview(result);
          setPreviewState('idle');
        })
        .catch(() => {
          if (!cancelled) setPreviewState('failed');
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [rulesKey, complete]);

  function touch(): void {
    setSaved(false);
  }

  function update(key: number, change: Partial<DraftCondition>): void {
    setConditions((current) => current.map((entry) => (entry.key === key ? { ...entry, ...change } : entry)));
    touch();
  }

  function add(): void {
    const key = nextKey.current;
    nextKey.current += 1;
    setConditions((current) => [...current, { key, field: 'tag', op: 'has', value: '', days: '30' }]);
    touch();
  }

  function remove(key: number): void {
    setConditions((current) => current.filter((entry) => entry.key !== key));
    touch();
  }

  function run<T>(label: string, promise: Promise<T>, after: (result: T) => void): void {
    setBusy(label);
    setError(null);
    setFieldErrors({});
    void promise
      .then((result) => {
        after(result);
      })
      .catch((cause: unknown) => {
        if (cause instanceof MutationError) {
          setError(cause.message);
          setFieldErrors(cause.fieldErrors);
        } else setError('That could not be saved.');
      })
      .finally(() => {
        setBusy(null);
      });
  }

  function save(): void {
    if (!complete) {
      setError('Finish or remove the unfinished condition before saving.');
      return;
    }
    const body = { name, description, rules };
    if (segment) {
      run('save', adminMutate(`/admin/segments/${encodeURIComponent(segment.id)}`, { method: 'PATCH', body }), () => {
        setSaved(true);
        router.refresh();
      });
      return;
    }
    run('save', adminMutate<AdminSegment>('/admin/segments', { method: 'POST', body }), (created) => {
      router.push(`/admin/subscribers/segments/${created.id}/`);
    });
  }

  function destroy(): void {
    if (!segment) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    run('delete', adminMutate(`/admin/segments/${encodeURIComponent(segment.id)}`, { method: 'DELETE' }), () => {
      router.push('/admin/subscribers/segments/');
      router.refresh();
    });
  }

  const disabled = !mayWrite || busy !== null;
  const conditionError = (index: number): string | undefined =>
    Object.entries(fieldErrors).find(([key]) => key.startsWith(`rules.conditions.${String(index)}`))?.[1][0];

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 border-t border-admin-line pt-4">
        <div className="flex flex-col gap-[3px]">
          <label htmlFor="segment-name" className={LABEL}>
            Name
          </label>
          <input
            id="segment-name"
            value={name}
            disabled={disabled}
            maxLength={80}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? 'segment-name-error' : undefined}
            onChange={(event) => {
              setName(event.target.value);
              touch();
            }}
            className={`${INPUT} ${fieldErrors.name ? 'border-danger' : ''}`}
          />
          {fieldErrors.name ? (
            <p id="segment-name-error" role="alert" className="text-[11px] text-danger">
              {fieldErrors.name.join(' ')}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-[3px]">
          <label htmlFor="segment-description" className={LABEL}>
            Description
          </label>
          <textarea
            id="segment-description"
            value={description}
            disabled={disabled}
            rows={2}
            maxLength={300}
            onChange={(event) => {
              setDescription(event.target.value);
              touch();
            }}
            placeholder="Who this is for, in a sentence. Optional."
            className="w-full rounded-[4px] border border-admin-line bg-admin-surface px-2 py-1.5 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus disabled:opacity-60"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-admin-line pt-4">
        <div>
          <h2 className="text-[10px] font-bold tracking-[0.14em] text-admin-muted uppercase">Rules</h2>
          <p className="mt-1 text-[11.5px] text-admin-body">
            No rules reaches everyone who may be mailed. The suppression list and unsubscribes are always left out.
          </p>
        </div>

        {conditions.length > 1 ? (
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="sr-only">How the rules combine</legend>
            {(['all', 'any'] as const).map((option) => (
              <button
                key={option}
                type="button"
                disabled={disabled}
                aria-pressed={match === option}
                onClick={() => {
                  setMatch(option);
                  touch();
                }}
                className={`h-8 rounded-[4px] border px-3 text-[12.5px] font-semibold disabled:opacity-60 ${
                  match === option
                    ? 'border-admin-edge bg-admin-nav text-admin-ink'
                    : 'border-admin-line text-admin-body hover:border-admin-focus'
                }`}
              >
                {option === 'all' ? 'Match every rule' : 'Match any rule'}
              </button>
            ))}
          </fieldset>
        ) : null}

        {conditions.length > 0 ? (
          <ol className="border-t border-admin-line">
            {conditions.map((draft, index) => {
              const choice = choiceFor(draft.field);
              const problem = conditionError(index);
              const baseId = `condition-${String(draft.key)}`;
              return (
                <li key={draft.key} className="border-b border-admin-line py-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex w-full flex-col gap-[3px] sm:w-[170px]">
                      <span className={LABEL}>{index === 0 ? 'Where' : match === 'all' ? 'And' : 'Or'}</span>
                      <select
                        value={draft.field}
                        disabled={disabled}
                        onChange={(event) => {
                          const next = FIELDS.find((option) => option.field === event.target.value);
                          if (next) update(draft.key, { field: next.field, op: next.ops[0]?.op ?? '', value: '' });
                        }}
                        className={INPUT}
                      >
                        {FIELDS.map((option) => (
                          <option key={option.field} value={option.field}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex w-full flex-col gap-[3px] sm:w-[210px]">
                      <span className="sr-only">Condition</span>
                      <select
                        value={draft.op}
                        disabled={disabled}
                        onChange={(event) => {
                          update(draft.key, { op: event.target.value });
                        }}
                        className={INPUT}
                      >
                        {choice.ops.map((option) => (
                          <option key={option.op} value={option.op}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-[140px] flex-1 flex-col gap-[3px]">
                      <span className="sr-only">{choice.takes === 'days' ? 'Number of days' : 'Value'}</span>
                      {choice.takes === 'days' ? (
                        <input
                          type="number"
                          min={1}
                          max={3650}
                          inputMode="numeric"
                          value={draft.days}
                          disabled={disabled}
                          aria-invalid={problem ? true : undefined}
                          aria-describedby={problem ? `${baseId}-error` : undefined}
                          onChange={(event) => {
                            update(draft.key, { days: event.target.value });
                          }}
                          className={`${INPUT} ${problem ? 'border-danger' : ''}`}
                        />
                      ) : (
                        <input
                          value={draft.value}
                          disabled={disabled}
                          placeholder={choice.placeholder}
                          list={draft.field === 'tag' ? 'segment-known-tags' : undefined}
                          aria-invalid={problem ? true : undefined}
                          aria-describedby={problem ? `${baseId}-error` : undefined}
                          onChange={(event) => {
                            update(draft.key, { value: event.target.value });
                          }}
                          className={`${INPUT} ${problem ? 'border-danger' : ''}`}
                        />
                      )}
                    </label>
                    {mayWrite ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          remove(draft.key);
                        }}
                        aria-label={`Remove rule ${String(index + 1)}`}
                        className="h-[30px] rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus disabled:opacity-40"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {problem ? (
                    <p id={`${baseId}-error`} role="alert" className="mt-1 text-[11px] text-danger">
                      {problem}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}

        <datalist id="segment-known-tags">
          {knownTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>

        {mayWrite ? (
          <div>
            <button
              type="button"
              onClick={add}
              disabled={disabled || conditions.length >= 20}
              className="h-8 rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus disabled:opacity-40"
            >
              Add a rule
            </button>
          </div>
        ) : null}
      </section>

      <section aria-live="polite" className="border-t border-admin-line pt-4">
        <h2 className="text-[10px] font-bold tracking-[0.14em] text-admin-muted uppercase">Who this reaches now</h2>
        {!complete ? (
          <p className="mt-2 text-[12.5px] text-admin-body">Finish the rule you are writing to see the count.</p>
        ) : previewState === 'failed' ? (
          <p className="mt-2 text-[12.5px] text-admin-body">The count could not be worked out. Check the rules.</p>
        ) : preview ? (
          <div className={previewState === 'loading' ? 'opacity-60' : undefined}>
            <p className="mt-2 font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink tabular-nums">
              {`${preview.count.toLocaleString()} of ${preview.eligible.toLocaleString()}`}
            </p>
            <p className="text-[12px] text-admin-body">{`subscribers who may be mailed · ${describeRules(rules)}`}</p>
            {preview.sample.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {preview.sample.map((person) => (
                  <li key={person.email} className="text-[12px] break-all text-admin-muted">
                    {person.name ? `${person.name} · ${person.email}` : person.email}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-admin-body">Counting…</p>
        )}
      </section>

      {error ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}

      {mayWrite ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-admin-line pt-4">
          <button
            type="button"
            onClick={save}
            disabled={disabled}
            className="h-9 rounded-[4px] bg-primary px-4 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh disabled:opacity-40"
          >
            {busy === 'save' ? 'Saving…' : segment ? 'Save' : 'Create segment'}
          </button>
          {saved ? (
            <span role="status" className="text-[12px] text-admin-body">
              Saved.
            </span>
          ) : null}
          {segment ? (
            <span className="ms-auto flex flex-wrap items-center gap-2">
              {confirmingDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                  }}
                  className="h-9 rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus"
                >
                  Keep it
                </button>
              ) : null}
              <button
                type="button"
                onClick={destroy}
                disabled={disabled || segment.campaignCount > 0}
                title={segment.campaignCount > 0 ? 'A segment a campaign uses cannot be deleted.' : undefined}
                className="h-9 rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-danger hover:border-danger disabled:opacity-40"
              >
                {busy === 'delete' ? 'Deleting…' : confirmingDelete ? 'Yes, delete it' : 'Delete segment'}
              </button>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
