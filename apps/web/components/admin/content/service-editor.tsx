'use client';
import { slugify } from '@calwebtech/shared/slugify';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ExternalIcon, PlusIcon } from '@/components/admin/icons';
import { ERROR, HELP, KICKER, SELECT, TEXTAREA, button } from '@/components/admin/ui/styles';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { Action, Area, Field, Help, INPUT, LABEL, Section, StatusPill } from './editor-parts';

/**
 * The service editor (docs/12-admin-dashboard.md, M4).
 *
 * Four fields are required — name, address, summary and answer block — because the template
 * supplies every section heading for a record with no copy of its own. Everything below
 * them adds a section to the page and can be left empty; the public template drops a
 * section it has nothing for rather than rendering an empty band.
 *
 * Publishing is a separate action from saving, so nothing reaches the site because someone
 * pressed save while thinking. The fields sit in cards on the left; what happens to the
 * page — its state, saving, publishing, deleting — and how it reads in search stay in a
 * column on the right that keeps up as the form scrolls.
 */
export interface Step {
  title: string;
  duration: string;
  body: string;
}

export interface ServiceDraft {
  id: string | null;
  title: string;
  slug: string;
  shortDescription: string;
  answerBlock: string;
  categoryId: string | null;
  icon: string | null;
  heroMediaUrl: string | null;
  problemStatement: string | null;
  deliverables: string[];
  processSteps: Step[];
  startingPriceBand: string | null;
  order: number;
  seoTitle: string;
  seoDescription: string;
  status: string;
  shadowsSnapshot: boolean;
  hasOwnContent: boolean;
}

export function ServiceEditor({
  draft,
  categories,
  statusLabels,
}: {
  draft: ServiceDraft;
  categories: { id: string; name: string }[];
  statusLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [form, setForm] = useState(draft);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const body = (): unknown => ({
    title: form.title,
    slug: form.slug || slugify(form.title),
    shortDescription: form.shortDescription,
    answerBlock: form.answerBlock,
    categoryId: form.categoryId,
    icon: form.icon || null,
    heroMediaUrl: form.heroMediaUrl || null,
    problemStatement: form.problemStatement || null,
    deliverables: form.deliverables.filter((entry) => entry.trim().length > 0),
    processSteps: form.processSteps.filter((step) => step.title.trim().length > 0),
    startingPriceBand: form.startingPriceBand || null,
    order: form.order,
    seo: {
      ...(form.seoTitle.trim() ? { title: form.seoTitle.trim() } : {}),
      ...(form.seoDescription.trim() ? { description: form.seoDescription.trim() } : {}),
    },
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
          setError(cause.message);
          setFieldErrors(cause.fieldErrors);
        } else setError('That could not be saved.');
      })
      .finally(() => {
        setBusy(null);
      });
  }

  const save = (): void => {
    if (form.id) {
      run('save', adminMutate(`/admin/services/${encodeURIComponent(form.id)}`, { method: 'PATCH', body: body() }));
      return;
    }
    run('save', adminMutate<{ id: string }>('/admin/services', { method: 'POST', body: body() }), (result) => {
      const created = result as { id: string };
      router.replace(`/admin/content/services/${created.id}/`);
    });
  };

  const live = form.status === 'PUBLISHED';
  const answerLength = form.answerBlock.trim().length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Section heading="Basics" help="What the page is called, where it lives on the site, and the line that introduces it.">
          <Field
            label="Name"
            id="svc-title"
            value={form.title}
            errors={fieldErrors.title}
            help="As it appears in the menu and at the top of the page."
            onChange={(value) => {
              setForm((current) => ({
                ...current,
                title: value,
                // The address follows the name until someone edits it, then it stops moving:
                // a published slug that changes leaves a redirect behind.
                slug: current.slug === slugify(current.title) ? slugify(value) : current.slug,
              }));
              setSaved(false);
            }}
          />
          <Field
            label="Address"
            id="svc-slug"
            value={form.slug}
            errors={fieldErrors.slug}
            prefix="/services/"
            onChange={(value) => {
              set('slug', value);
            }}
            help={
              live
                ? 'This page is published. Changing its address sends the old one to the new one automatically, so no link breaks.'
                : 'Follows the name until you change it. Lower-case words joined with hyphens.'
            }
          />
          <Area
            label="Summary"
            id="svc-summary"
            rows={2}
            value={form.shortDescription}
            errors={fieldErrors.shortDescription}
            help="One sentence a buyer would recognise. Used on the index, the menu and as the page's opening line."
            onChange={(value) => {
              set('shortDescription', value);
            }}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_120px] lg:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="svc-category" className={LABEL}>
                Category
              </label>
              <select
                id="svc-category"
                value={form.categoryId ?? ''}
                onChange={(event) => {
                  set('categoryId', event.target.value || null);
                }}
                className={SELECT}
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <Help help="Groups the service on the services index." />
            </div>
            <Field
              label="Order"
              id="svc-order"
              value={String(form.order)}
              onChange={(value) => {
                set('order', Number(value) || 0);
              }}
              type="number"
              help="Lower comes first."
            />
            <Field
              label="Starting price band"
              id="svc-price"
              value={form.startingPriceBand ?? ''}
              onChange={(value) => {
                set('startingPriceBand', value);
              }}
              help="Optional. What the service starts from, as you would say it to a customer."
            />
          </div>
        </Section>

        <Section
          heading="Answer block"
          help="The first thing on the page: a direct answer to the question the page is about, before any selling. Search engines and AI assistants quote this part, so every page needs one."
        >
          <Area
            label="Answer block"
            id="svc-answer"
            rows={4}
            value={form.answerBlock}
            errors={fieldErrors.answerBlock}
            help={`Two or three complete sentences: what it is, who it is for and what they get. ${String(answerLength)} characters so far, between 80 and 600 is right.`}
            onChange={(value) => {
              set('answerBlock', value);
            }}
          />
        </Section>

        <Section
          heading="Page content"
          help="Each of these adds a section to the page. Leave one empty and the page simply leaves that section out."
        >
          <Area
            label="The problem"
            id="svc-problem"
            rows={3}
            value={form.problemStatement ?? ''}
            help="What goes wrong for a business without this, in the customer's own words."
            onChange={(value) => {
              set('problemStatement', value);
            }}
          />
          <List
            label="What is included"
            values={form.deliverables}
            placeholder="One deliverable per line"
            onChange={(values) => {
              set('deliverables', values);
            }}
          />
          <Steps
            steps={form.processSteps}
            onChange={(steps) => {
              set('processSteps', steps);
            }}
          />
          <Field
            label="Hero image"
            id="svc-hero"
            value={form.heroMediaUrl ?? ''}
            onChange={(value) => {
              set('heroMediaUrl', value);
            }}
            help="Paste a path from the media library, such as /api/media/<id>/original.jpg."
          />
        </Section>
      </div>

      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Section
          heading="Publishing"
          help={
            form.id
              ? 'Saving keeps your changes here. Publishing is what puts them on the site.'
              : 'Save a draft first. Publishing becomes available once it exists.'
          }
        >
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3 text-[14px]">
              <span className="text-admin-muted">Status</span>
              <StatusPill status={form.status} label={statusLabels[form.status] ?? form.status} />
            </div>
            {form.shadowsSnapshot ? (
              <p className={HELP}>
                Visitors still see the site&apos;s built-in page at /services/{form.slug}/ until this is published.
              </p>
            ) : null}
            {form.hasOwnContent ? <p className={HELP}>This record has section copy of its own.</p> : null}
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
              {form.id ? 'Save' : 'Create draft'}
            </Action>
            {form.id ? (
              <div className="grid grid-cols-2 gap-2">
                {live ? (
                  <Action
                    busy={busy === 'publish'}
                    onClick={() => {
                      run('publish', adminMutate(`/admin/services/${encodeURIComponent(form.id ?? '')}/unpublish`, { method: 'POST' }));
                    }}
                  >
                    Unpublish
                  </Action>
                ) : (
                  <Action
                    busy={busy === 'publish'}
                    onClick={() => {
                      run('publish', adminMutate(`/admin/services/${encodeURIComponent(form.id ?? '')}/publish`, { method: 'POST', body: {} }));
                    }}
                  >
                    Publish
                  </Action>
                )}
                <a href={`/services/${form.slug}/`} target="_blank" rel="noreferrer" className={button('secondary')}>
                  View page
                  <ExternalIcon className="size-4" />
                </a>
              </div>
            ) : null}
          </div>

          {form.id ? (
            <div className="flex flex-col gap-2 border-t border-admin-line2 pt-4">
              <button
                type="button"
                disabled={busy === 'delete'}
                onClick={() => {
                  run('delete', adminMutate(`/admin/services/${encodeURIComponent(form.id ?? '')}`, { method: 'DELETE' }), () => {
                    router.replace('/admin/content/');
                  });
                }}
                className={`${button('danger')} self-start`}
              >
                {busy === 'delete' ? 'Working…' : 'Delete this service'}
              </button>
              <p className={HELP}>
                The record is kept so its history still names it, and a published address keeps working by
                redirecting to the services index.
              </p>
            </div>
          ) : null}
        </Section>

        <Section
          heading="Search result"
          help="How the page reads in Google and when it is shared. Both fall back to the name and summary when left empty."
        >
          <Counted
            label="Title"
            id="svc-seo-title"
            max={60}
            value={form.seoTitle}
            errors={fieldErrors['seo.title']}
            onChange={(value) => {
              set('seoTitle', value);
            }}
          />
          <Counted
            label="Description"
            id="svc-seo-description"
            max={155}
            rows={3}
            value={form.seoDescription}
            errors={fieldErrors['seo.description']}
            onChange={(value) => {
              set('seoDescription', value);
            }}
          />
        </Section>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

/** A text field with a live count against the length search engines show. */
function Counted({
  label,
  id,
  value,
  max,
  rows,
  errors,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  max: number;
  rows?: number;
  errors?: string[];
  onChange: (value: string) => void;
}) {
  const over = value.length > max;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
        <span className={`text-[12px] tabular-nums ${over ? 'font-semibold text-danger' : 'text-admin-muted'}`}>
          {value.length}/{max}
        </span>
      </div>
      {rows ? (
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
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          aria-invalid={errors ? true : undefined}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className={INPUT}
        />
      )}
      <Help errors={errors} help={over ? `Keep this to ${String(max)} characters or fewer.` : undefined} />
    </div>
  );
}

function List({
  label,
  values,
  placeholder,
  onChange,
}: {
  label: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor="svc-deliverables" className={LABEL}>
        {label}
      </label>
      <textarea
        id="svc-deliverables"
        rows={4}
        value={values.join('\n')}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value.split('\n'));
        }}
        className={TEXTAREA}
      />
      <Help help="One item per line. The page shows them as a list." />
    </div>
  );
}

function Steps({ steps, onChange }: { steps: Step[]; onChange: (steps: Step[]) => void }) {
  const update = (index: number, patch: Partial<Step>): void => {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className={LABEL}>How the work runs</span>
        <p className={HELP}>The steps a customer goes through, in order: what each is called, how long it takes and what happens.</p>
      </div>
      {steps.length === 0 ? <p className={HELP}>No steps yet, so the page leaves this section out.</p> : null}
      {steps.map((step, index) => (
        <div key={index} className="flex flex-col gap-2.5 rounded-lg border border-admin-line2 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <span className={KICKER}>Step {index + 1}</span>
            <button
              type="button"
              onClick={() => {
                onChange(steps.filter((_, i) => i !== index));
              }}
              className={button('ghost', 'sm')}
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_150px]">
            <input
              aria-label={`Step ${String(index + 1)} name`}
              value={step.title}
              placeholder="What the step is called"
              onChange={(event) => {
                update(index, { title: event.target.value });
              }}
              className={INPUT}
            />
            <input
              aria-label={`Step ${String(index + 1)} duration`}
              value={step.duration}
              placeholder="How long"
              onChange={(event) => {
                update(index, { duration: event.target.value });
              }}
              className={INPUT}
            />
          </div>
          <input
            aria-label={`Step ${String(index + 1)} description`}
            value={step.body}
            placeholder="What happens"
            onChange={(event) => {
              update(index, { body: event.target.value });
            }}
            className={INPUT}
          />
        </div>
      ))}
      <div>
        <button
          type="button"
          onClick={() => {
            onChange([...steps, { title: '', duration: '', body: '' }]);
          }}
          className={button('secondary', 'sm')}
        >
          <PlusIcon className="size-4" />
          Add a step
        </button>
      </div>
    </div>
  );
}
