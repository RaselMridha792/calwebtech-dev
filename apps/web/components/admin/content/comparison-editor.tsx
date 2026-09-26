'use client';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { ExternalIcon, PlusIcon, SortIcon } from '@/components/admin/icons';
import { CHECK, ERROR, HELP, LABEL, SELECT, button, iconButton } from '@/components/admin/ui/styles';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { plainErrors } from './plain-errors';
import { Action, Area, Field, Help, Section, StatusPill } from './editor-parts';

/**
 * The comparison editor (docs/15-next-tasks.md, task 4; docs/08-decisions.md, 70): one
 * comparison on `/before-and-after/`, as the page shows it. Its words, its two pictures each
 * with a description and, optionally, a size, up to four figures, and where it appears: its
 * place in the list, the homepage, and the case study it links to. The API checks everything
 * against the page's own rules on save and names each field it refuses.
 *
 * The fields sit in cards down the wide column; publishing has a column of its own on the
 * right from `lg`, where it stays in view, and sits above the fields under that.
 */

export interface PictureForm {
  src: string;
  alt: string;
  /** Pixels, as typed; empty when the size is not given. */
  width: string;
  height: string;
}

export interface FigureForm {
  label: string;
  before: string;
  after: string;
}

export interface ComparisonForm {
  clientName: string;
  heading: string;
  summary: string;
  before: PictureForm;
  after: PictureForm;
  metrics: FigureForm[];
  projectId: string | null;
  order: number;
  onHomepage: boolean;
}

export interface ComparisonDraft {
  id: string | null;
  status: string;
  shownOnHomepage: boolean;
  record: ComparisonForm;
}

/** At most four figures: the page's limit. */
const MAX_FIGURES = 4;

function picture(form: PictureForm): unknown {
  const size = (value: string): number | undefined => (value.trim() ? Number(value) : undefined);
  return { src: form.src.trim(), alt: form.alt.trim(), width: size(form.width), height: size(form.height) };
}

export function ComparisonEditor({
  draft,
  caseStudies,
  statusLabels,
  liveNote,
}: {
  draft: ComparisonDraft;
  caseStudies: { id: string; clientName: string; slug: string; status: string }[];
  statusLabels: Record<string, string>;
  /** Whether a saved change reaches the site, in words; the server knows its own settings. */
  liveNote: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(draft.record);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof ComparisonForm>(key: K, value: ComparisonForm[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const body = (): unknown => ({
    ...form,
    before: picture(form.before),
    after: picture(form.after),
  });

  function run(label: string, promise: Promise<unknown>, after?: (result: unknown) => void): void {
    setBusy(label);
    setError(null);
    setFieldErrors({});
    void promise
      .then((result) => {
        setSaved(true);
        after?.(result);
        router.refresh();
      })
      .catch((cause: unknown) => {
        if (cause instanceof MutationError) {
          const perField = Object.keys(cause.fieldErrors).length > 0;
          setError(perField ? 'Some fields need attention; each says why under it.' : cause.message);
          setFieldErrors(plainErrors(cause.fieldErrors));
        } else setError('That could not be saved.');
      })
      .finally(() => {
        setBusy(null);
      });
  }

  const path = (suffix = ''): string => `/admin/comparisons/${encodeURIComponent(draft.id ?? '')}${suffix}`;
  const save = (): void => {
    if (draft.id) {
      run('save', adminMutate(path(), { method: 'PATCH', body: body() }));
      return;
    }
    run('save', adminMutate<{ id: string }>('/admin/comparisons', { method: 'POST', body: body() }), (result) => {
      router.replace(`/admin/before-and-after/${(result as { id: string }).id}/`);
    });
  };
  const live = draft.status === 'PUBLISHED';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:order-last lg:self-start">
        <Section
          heading="Publishing"
          help={
            draft.id
              ? 'Saving keeps your changes here. Publishing is what puts the comparison on the site.'
              : 'Save a draft first. Publishing becomes available once it exists.'
          }
        >
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3 text-[14px]">
              <span className="text-admin-muted">Status</span>
              <StatusPill status={draft.status} label={statusLabels[draft.status] ?? draft.status} />
            </div>
            <div className="flex items-center justify-between gap-3 text-[14px]">
              <span className="text-admin-muted">Homepage</span>
              <span className="text-right text-ink-invert">{draft.shownOnHomepage ? 'Shown there now' : 'Not shown there'}</span>
            </div>
            <p className={HELP}>{liveNote}</p>
          </div>

          {error ? (
            <p role="alert" className={ERROR}>
              {error}
            </p>
          ) : saved ? (
            <p
              role="status"
              className="flex items-center gap-2 text-[13.5px] text-ink-invert-muted motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]"
            >
              <span aria-hidden className="size-2 rounded-full bg-result" />
              Saved and audited
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Action busy={busy === 'save'} primary onClick={save}>
              {draft.id ? 'Save' : 'Create draft'}
            </Action>
            {draft.id ? (
              <div className="grid grid-cols-2 gap-2">
                <Action
                  busy={busy === 'publish'}
                  onClick={() => {
                    run('publish', adminMutate(path(live ? '/unpublish' : '/publish'), { method: 'POST' }));
                  }}
                >
                  {live ? 'Unpublish' : 'Publish'}
                </Action>
                <a href="/before-and-after/" target="_blank" rel="noreferrer" className={button('secondary')}>
                  View page
                  <ExternalIcon className="size-4" />
                </a>
              </div>
            ) : null}
          </div>

          {draft.id ? (
            <div className="flex flex-col gap-2 border-t border-admin-line2 pt-4">
              {confirming ? (
                <div role="group" aria-label="Confirm deletion" className="flex flex-col gap-2">
                  <p className="text-[13.5px] leading-[1.5] text-ink-invert-muted">
                    Delete this comparison? It comes off the site; the record and its history are kept.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy === 'delete'}
                      onClick={() => {
                        run('delete', adminMutate(path(), { method: 'DELETE' }), () => {
                          router.replace('/admin/before-and-after/');
                        });
                      }}
                      className={button('danger', 'sm')}
                    >
                      {busy === 'delete' ? 'Working…' : 'Yes, delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(false);
                      }}
                      className={button('ghost', 'sm')}
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(true);
                  }}
                  className={`${button('danger')} self-start`}
                >
                  Delete this comparison
                </button>
              )}
            </div>
          ) : null}
        </Section>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <Section heading="Words" help="Who the site belonged to, the comparison's heading and one or two sentences on what changed.">
          <Field
            label="Client"
            id="cmp-client"
            value={form.clientName}
            errors={fieldErrors.clientName}
            help="Also names the slider for screen readers: “Reveal the redesigned … website”."
            onChange={(value) => {
              set('clientName', value);
            }}
          />
          <Field
            label="Heading"
            id="cmp-heading"
            value={form.heading}
            errors={fieldErrors.heading}
            help="Written as the question a buyer would type, ending with a question mark."
            onChange={(value) => {
              set('heading', value);
            }}
          />
          <Area
            label="Summary"
            id="cmp-summary"
            rows={4}
            value={form.summary}
            errors={fieldErrors.summary}
            help="Up to 300 characters, under the heading."
            onChange={(value) => {
              set('summary', value);
            }}
          />
        </Section>

        <Section
          heading="Pictures"
          help="The same screen before and after, taken the same way. Each needs a description of what it shows. With its size in pixels the slider takes the picture's shape; without it, the frame is 16:10."
        >
          <PictureFields
            legend="Before"
            name="before"
            value={form.before}
            errors={fieldErrors}
            onChange={(value) => {
              set('before', value);
            }}
          />
          <PictureFields
            legend="After"
            name="after"
            value={form.after}
            errors={fieldErrors}
            onChange={(value) => {
              set('after', value);
            }}
          />
        </Section>

        <Section
          heading="Figures"
          help="Up to four measures that moved, each with its value before and after. Leave them out if nobody measured them."
        >
          <Figures
            figures={form.metrics}
            errors={fieldErrors}
            onChange={(value) => {
              set('metrics', value);
            }}
          />
        </Section>

        <Section heading="Where it appears" help="Its place on /before-and-after/, the homepage, and the case study it links to.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Position"
              id="cmp-order"
              type="number"
              value={String(form.order)}
              errors={fieldErrors.order}
              help="Lower comes first on the page."
              onChange={(value) => {
                set('order', Number(value) || 0);
              }}
            />
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="cmp-case-study" className={LABEL}>
                Case study
              </label>
              <select
                id="cmp-case-study"
                value={form.projectId ?? ''}
                onChange={(event) => {
                  set('projectId', event.target.value || null);
                }}
                className={SELECT}
              >
                <option value="">No case study</option>
                {caseStudies.map((study) => (
                  <option key={study.id} value={study.id}>
                    {study.status === 'PUBLISHED' ? study.clientName : `${study.clientName} (${(statusLabels[study.status] ?? study.status).toLowerCase()})`}
                  </option>
                ))}
              </select>
              <Help
                errors={fieldErrors.projectId}
                help="Adds a “Read the case study” link, shown while that case study is published."
              />
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-[14px] text-ink-invert">
            <input
              type="checkbox"
              className={CHECK}
              checked={form.onHomepage}
              onChange={(event) => {
                set('onHomepage', event.target.checked);
              }}
            />
            Show on the homepage
          </label>
          <p className={`${HELP} -mt-3`}>
            The homepage shows one comparison: the first published one with this ticked, in the order of the list.
          </p>
        </Section>
      </div>
    </div>
  );
}

/** One picture: its address, its description and its size. */
function PictureFields({
  legend,
  name,
  value,
  errors,
  onChange,
}: {
  legend: string;
  name: 'before' | 'after';
  value: PictureForm;
  errors: Record<string, string[]>;
  onChange: (value: PictureForm) => void;
}) {
  const id = `cmp-${name}`;
  const set = (key: keyof PictureForm) => (text: string) => {
    onChange({ ...value, [key]: text });
  };
  return (
    <fieldset className="flex min-w-0 flex-col gap-4 border-l-2 border-admin-line2 pl-4 sm:pl-5">
      <legend className="mb-3 font-display text-[15px] font-bold text-ink-invert">{legend}</legend>
      <Field
        label="Image address"
        id={`${id}-src`}
        value={value.src}
        errors={errors[`${name}.src`]}
        help="From the media library, or a /media/ path."
        onChange={set('src')}
      />
      <Area
        label="Image description"
        id={`${id}-alt`}
        rows={3}
        value={value.alt}
        errors={errors[`${name}.alt`]}
        help="What the picture shows, for someone who cannot see it."
        onChange={set('alt')}
      />
      <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
        <Field
          label="Width (px)"
          id={`${id}-width`}
          type="number"
          value={value.width}
          errors={errors[`${name}.width`]}
          onChange={set('width')}
        />
        <Field
          label="Height (px)"
          id={`${id}-height`}
          type="number"
          value={value.height}
          errors={errors[`${name}.height`]}
          onChange={set('height')}
        />
      </div>
    </fieldset>
  );
}

/** The figures: add up to four, reorder and remove. */
function Figures({
  figures,
  errors,
  onChange,
}: {
  figures: FigureForm[];
  errors: Record<string, string[]>;
  onChange: (value: FigureForm[]) => void;
}) {
  const base = useId();
  const move = (from: number, to: number): void => {
    const next = [...figures];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    onChange(next);
  };
  const edit = (index: number, key: keyof FigureForm) => (text: string) => {
    onChange(figures.map((figure, i) => (i === index ? { ...figure, [key]: text } : figure)));
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {figures.length === 0 ? <p className={HELP}>No figures. The comparison shows the slider alone.</p> : null}
      {figures.length > 0 ? (
        <ol className="flex min-w-0 flex-col gap-3">
          {figures.map((figure, index) => {
            const name = `Figure ${String(index + 1)}`;
            return (
              <li key={index} className="flex min-w-0 flex-col gap-4 rounded-lg border border-admin-line2 bg-admin-sunken p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold text-ink-invert">{name}</p>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className={iconButton('sm')}
                      disabled={index === 0}
                      aria-label={`Move ${name} up`}
                      onClick={() => {
                        move(index, index - 1);
                      }}
                    >
                      <SortIcon direction="asc" className="size-4" />
                    </button>
                    <button
                      type="button"
                      className={iconButton('sm')}
                      disabled={index === figures.length - 1}
                      aria-label={`Move ${name} down`}
                      onClick={() => {
                        move(index, index + 1);
                      }}
                    >
                      <SortIcon direction="desc" className="size-4" />
                    </button>
                    <button
                      type="button"
                      className={button('ghost', 'sm')}
                      aria-label={`Remove ${name}`}
                      onClick={() => {
                        onChange(figures.filter((_, i) => i !== index));
                      }}
                    >
                      Remove
                    </button>
                  </span>
                </div>
                <Field
                  label="What was measured"
                  id={`${base}-${String(index)}-label`}
                  value={figure.label}
                  errors={errors[`metrics.${String(index)}.label`]}
                  onChange={edit(index, 'label')}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Before"
                    id={`${base}-${String(index)}-before`}
                    value={figure.before}
                    errors={errors[`metrics.${String(index)}.before`]}
                    onChange={edit(index, 'before')}
                  />
                  <Field
                    label="After"
                    id={`${base}-${String(index)}-after`}
                    value={figure.after}
                    errors={errors[`metrics.${String(index)}.after`]}
                    onChange={edit(index, 'after')}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      {errors.metrics?.length ? (
        <p role="alert" className={ERROR}>
          {errors.metrics.join(' ')}
        </p>
      ) : null}
      {figures.length < MAX_FIGURES ? (
        <div>
          <button
            type="button"
            className={button('secondary', 'sm')}
            onClick={() => {
              onChange([...figures, { label: '', before: '', after: '' }]);
            }}
          >
            <PlusIcon className="size-4" />
            Add a figure
          </button>
        </div>
      ) : (
        <p className={HELP}>Four figures is the most the page shows.</p>
      )}
    </div>
  );
}
