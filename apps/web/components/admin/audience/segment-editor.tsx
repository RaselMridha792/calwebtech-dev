'use client';
import type { AdminSegment, SegmentCondition, SegmentField, SegmentPreview, SegmentRules } from '@calwebtech/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CloseIcon, PlusIcon } from '@/components/admin/icons';
import {
  CARD,
  CARD_PAD,
  ERROR,
  H2,
  HELP,
  INPUT,
  KICKER,
  LABEL,
  SELECT,
  TEXTAREA,
  button,
  iconButton,
} from '@/components/admin/ui/styles';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { describeRules } from './describe-rules';

/**
 * The segment builder (docs/12-admin-dashboard.md, module 4).
 *
 * The count beside the rules is live: every change asks the API, a moment after the typing
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

/** A card with a heading row, composed here so the client bundle carries no page kit. */
function Card({
  title,
  description,
  labelledBy,
  children,
  live,
}: {
  title: string;
  description?: string;
  labelledBy: string;
  children: React.ReactNode;
  live?: boolean;
}) {
  return (
    <section aria-labelledby={labelledBy} aria-live={live ? 'polite' : undefined} className={`${CARD} ${CARD_PAD}`}>
      <div className="mb-5 flex flex-col gap-1">
        <h2 id={labelledBy} className={H2}>
          {title}
        </h2>
        {description ? <p className="text-[13.5px] leading-[1.55] text-ink-invert-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card title="Name" labelledBy="segment-about" description="What the segment is called where a campaign picks its audience.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="segment-name" className={LABEL}>
                Name
              </label>
              <input
                id="segment-name"
                value={name}
                disabled={disabled}
                maxLength={80}
                placeholder="Newsletter readers"
                aria-invalid={fieldErrors.name ? true : undefined}
                aria-describedby={fieldErrors.name ? 'segment-name-error' : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  touch();
                }}
                className={INPUT}
              />
              {fieldErrors.name ? (
                <p id="segment-name-error" role="alert" className={ERROR}>
                  {fieldErrors.name.join(' ')}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
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
                className={TEXTAREA}
              />
            </div>
          </div>
        </Card>

        <Card
          title="Rules"
          labelledBy="segment-rules"
          description="Each rule narrows who is included. With no rules the segment reaches everyone who may be mailed; the suppression list and unsubscribes are always left out."
        >
          <div className="flex flex-col gap-4">
            {conditions.length > 1 ? (
              <fieldset className="flex flex-wrap items-center gap-3">
                <legend className="sr-only">How the rules combine</legend>
                <span className={KICKER}>Include people who</span>
                <div className="inline-flex rounded-lg border border-admin-line p-0.5">
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
                      className={`h-8 rounded-md px-3 text-[13px] font-semibold transition-colors duration-150 disabled:opacity-50 pointer-coarse:h-10 ${
                        match === option ? 'bg-admin-nav text-ink-invert' : 'text-ink-invert-muted hover:text-ink-invert'
                      }`}
                    >
                      {option === 'all' ? 'Match every rule' : 'Match any rule'}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {conditions.length > 0 ? (
              <ol className="flex flex-col gap-3">
                {conditions.map((draft, index) => {
                  const choice = choiceFor(draft.field);
                  const problem = conditionError(index);
                  const baseId = `condition-${String(draft.key)}`;
                  return (
                    <li key={draft.key} className="rounded-lg border border-admin-line2 bg-admin-sunken/40 p-3 sm:p-4">
                      {/*
                        On a phone the connector word and the remove button share the first row and
                        the three controls stack under them; from `sm` the whole rule reads as one line.
                      */}
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[auto_minmax(0,1.05fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_auto] sm:gap-3">
                        <label
                          htmlFor={`${baseId}-field`}
                          className="text-[12px] font-bold tracking-[0.08em] text-admin-muted uppercase sm:w-14"
                        >
                          {index === 0 ? 'Where' : match === 'all' ? 'And' : 'Or'}
                        </label>
                        {mayWrite ? (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              remove(draft.key);
                            }}
                            aria-label={`Remove rule ${String(index + 1)}`}
                            title="Remove this rule"
                            className={`${iconButton('sm')} sm:order-last`}
                          >
                            <CloseIcon className="size-4" />
                          </button>
                        ) : null}
                        <select
                          id={`${baseId}-field`}
                          value={draft.field}
                          disabled={disabled}
                          onChange={(event) => {
                            const next = FIELDS.find((option) => option.field === event.target.value);
                            if (next) update(draft.key, { field: next.field, op: next.ops[0]?.op ?? '', value: '' });
                          }}
                          className={`${SELECT} col-span-2 sm:col-span-1`}
                        >
                          {FIELDS.map((option) => (
                            <option key={option.field} value={option.field}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
                          <label htmlFor={`${baseId}-op`} className="sr-only">
                            Condition
                          </label>
                          <select
                            id={`${baseId}-op`}
                            value={draft.op}
                            disabled={disabled}
                            onChange={(event) => {
                              update(draft.key, { op: event.target.value });
                            }}
                            className={SELECT}
                          >
                            {choice.ops.map((option) => (
                              <option key={option.op} value={option.op}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
                          <label htmlFor={`${baseId}-value`} className="sr-only">
                            {choice.takes === 'days' ? 'Number of days' : 'Value'}
                          </label>
                          {choice.takes === 'days' ? (
                            <input
                              id={`${baseId}-value`}
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
                              className={INPUT}
                            />
                          ) : (
                            <input
                              id={`${baseId}-value`}
                              value={draft.value}
                              disabled={disabled}
                              placeholder={choice.placeholder}
                              list={draft.field === 'tag' ? 'segment-known-tags' : undefined}
                              aria-invalid={problem ? true : undefined}
                              aria-describedby={problem ? `${baseId}-error` : undefined}
                              onChange={(event) => {
                                update(draft.key, { value: event.target.value });
                              }}
                              className={INPUT}
                            />
                          )}
                        </div>
                      </div>
                      {problem ? (
                        <p id={`${baseId}-error`} role="alert" className={`${ERROR} mt-2`}>
                          {problem}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-[14px] text-ink-invert-muted">
                No rules yet, so this segment reaches everyone who may be mailed.
                {mayWrite ? ' Add a rule to narrow it down.' : ''}
              </p>
            )}

            <datalist id="segment-known-tags">
              {knownTags.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>

            {mayWrite ? (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={add} disabled={disabled || conditions.length >= 20} className={button('secondary')}>
                  <PlusIcon className="size-4" />
                  Add a rule
                </button>
                {conditions.length >= 20 ? <span className={HELP}>A segment can have up to 20 rules.</span> : null}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Card title="Who this reaches now" labelledBy="segment-reach" live>
          {!complete ? (
            <p className="text-[14px] leading-[1.6] text-ink-invert-muted">Finish the rule you are writing to see the count.</p>
          ) : previewState === 'failed' ? (
            <p className="text-[14px] leading-[1.6] text-ink-invert-muted">The count could not be worked out. Check the rules.</p>
          ) : preview ? (
            <div className={`flex flex-col gap-3 transition-opacity duration-150 ${previewState === 'loading' ? 'opacity-60' : ''}`}>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-[36px] leading-none font-extrabold tracking-[-0.02em] text-ink-invert tabular-nums">
                  {preview.count.toLocaleString()}
                </span>
                <span className="text-[13.5px] text-admin-muted tabular-nums">{`of ${preview.eligible.toLocaleString()}`}</span>
              </p>
              <p className="text-[13.5px] leading-[1.55] text-ink-invert-muted">{`subscribers who may be mailed · ${describeRules(rules)}`}</p>
              {preview.sample.length > 0 ? (
                <div className="flex flex-col gap-2 border-t border-admin-line2 pt-3">
                  <span className={KICKER}>For example</span>
                  <ul className="flex flex-col gap-1">
                    {preview.sample.map((person) => (
                      <li key={person.email} className="text-[13px] break-all text-ink-invert-muted">
                        {person.name ? `${person.name} · ${person.email}` : person.email}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-[14px] leading-[1.6] text-ink-invert-muted">Counting…</p>
          )}
        </Card>

        {mayWrite ? (
          <Card
            title={segment ? 'Save changes' : 'Create the segment'}
            labelledBy="segment-save"
            description={segment ? 'Campaigns that use this segment pick up the new rules on their next send.' : undefined}
          >
            <div className="flex flex-col gap-3">
              {error ? (
                <p role="alert" className={ERROR}>
                  {error}
                </p>
              ) : null}
              <button type="button" onClick={save} disabled={disabled} className={`${button('primary')} w-full`}>
                {busy === 'save' ? 'Saving…' : segment ? 'Save' : 'Create segment'}
              </button>
              {saved ? (
                <p
                  role="status"
                  className="flex items-center gap-2 text-[13px] text-ink-invert-muted motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]"
                >
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-result" />
                  Saved.
                </p>
              ) : null}
              {segment ? (
                <div className="flex flex-col gap-2 border-t border-admin-line2 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={destroy}
                      disabled={disabled || segment.campaignCount > 0}
                      title={segment.campaignCount > 0 ? 'A segment a campaign uses cannot be deleted.' : undefined}
                      className={button('danger')}
                    >
                      {busy === 'delete' ? 'Deleting…' : confirmingDelete ? 'Yes, delete it' : 'Delete segment'}
                    </button>
                    {confirmingDelete ? (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingDelete(false);
                        }}
                        className={button('secondary')}
                      >
                        Keep it
                      </button>
                    ) : null}
                  </div>
                  <p className={HELP}>
                    {segment.campaignCount > 0
                      ? 'A segment a campaign uses cannot be deleted. Point the campaign at another segment first.'
                      : confirmingDelete
                        ? 'This removes the segment for good. The subscribers themselves are not touched.'
                        : 'Deleting a segment does not delete any subscriber.'}
                  </p>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}
