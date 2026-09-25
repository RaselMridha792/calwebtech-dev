'use client';
import { slugify } from '@calwebtech/shared/slugify';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { Action, Area, Field, INPUT, LABEL, Section } from './editor-parts';

/**
 * The service editor (docs/12-admin-dashboard.md, M4).
 *
 * Four fields are required — name, address, summary and answer block — because the template
 * supplies every section heading for a record with no copy of its own. Everything below
 * them adds a section to the page and can be left empty; the public template drops a
 * section it has nothing for rather than rendering an empty band.
 *
 * Publishing is a separate action from saving, so nothing reaches the site because someone
 * pressed save while thinking.
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2.5 rounded-[4px] border border-admin-line bg-admin-sunken px-3 py-2.5">
        <span className="text-[12.5px] font-semibold text-admin-ink">{statusLabels[form.status] ?? form.status}</span>
        {form.shadowsSnapshot ? (
          <span className="text-[11.5px] text-admin-muted">
            /services/{form.slug}/ is still served from the committed snapshot until this is published.
          </span>
        ) : null}
        {form.hasOwnContent ? (
          <span className="text-[11.5px] text-admin-muted">This record has section copy of its own.</span>
        ) : null}

        <span className="ml-auto flex flex-wrap gap-2">
          <Action busy={busy === 'save'} primary onClick={save}>
            {form.id ? 'Save' : 'Create draft'}
          </Action>
          {form.id ? (
            live ? (
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
            )
          ) : null}
          {form.id ? (
            <a
              href={`/services/${form.slug}/`}
              target="_blank"
              rel="noreferrer"
              className="flex h-[30px] items-center rounded-[4px] border border-admin-line px-3 text-[12px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink"
            >
              View page
            </a>
          ) : null}
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : saved ? (
        <p className="flex items-center gap-1.5 text-[12px] text-admin-body">
          <span aria-hidden className="size-[7px] rounded-full bg-result" />
          Saved and audited
        </p>
      ) : null}

      <Section heading="The page">
        <Field
          label="Name"
          id="svc-title"
          value={form.title}
          errors={fieldErrors.title}
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
          help={live ? 'Changing this leaves a permanent redirect from the old address.' : undefined}
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
        <Area
          label="Answer block"
          id="svc-answer"
          rows={3}
          value={form.answerBlock}
          errors={fieldErrors.answerBlock}
          help="Two or three sentences answering the page's question directly, before any marketing. This is what an answer engine quotes."
          onChange={(value) => {
            set('answerBlock', value);
          }}
        />
        <div className="flex flex-wrap gap-3">
          <div className="flex min-w-[200px] flex-1 flex-col gap-[3px]">
            <label htmlFor="svc-category" className={LABEL}>
              Category
            </label>
            <select
              id="svc-category"
              value={form.categoryId ?? ''}
              onChange={(event) => {
                set('categoryId', event.target.value || null);
              }}
              className={INPUT}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Order"
            id="svc-order"
            value={String(form.order)}
            onChange={(value) => {
              set('order', Number(value) || 0);
            }}
            type="number"
            narrow
          />
          <Field
            label="Starting price band"
            id="svc-price"
            value={form.startingPriceBand ?? ''}
            onChange={(value) => {
              set('startingPriceBand', value);
            }}
          />
        </div>
      </Section>

      <Section heading="Sections" help="Each one adds a band to the page. Leave a field empty and its band is left out.">
        <Area
          label="The problem"
          id="svc-problem"
          rows={3}
          value={form.problemStatement ?? ''}
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

      <Section heading="Search result" help="How the page reads in search and when it is shared. Both fall back to the name and summary.">
        <Field
          label={`Title (${String(form.seoTitle.length)}/60)`}
          id="svc-seo-title"
          value={form.seoTitle}
          errors={fieldErrors['seo.title']}
          onChange={(value) => {
            set('seoTitle', value);
          }}
        />
        <Area
          label={`Description (${String(form.seoDescription.length)}/155)`}
          id="svc-seo-description"
          rows={2}
          value={form.seoDescription}
          errors={fieldErrors['seo.description']}
          onChange={(value) => {
            set('seoDescription', value);
          }}
        />
      </Section>

      {form.id ? (
        <div className="border-t border-admin-line pt-4">
          <Action
            busy={busy === 'delete'}
            onClick={() => {
              run('delete', adminMutate(`/admin/services/${encodeURIComponent(form.id ?? '')}`, { method: 'DELETE' }), () => {
                router.replace('/admin/content/');
              });
            }}
          >
            Delete this service
          </Action>
          <p className="mt-1.5 text-[11px] text-admin-muted">
            The record is kept so its history still names it, and a published address keeps working by redirecting to
            the services index.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

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
    <div className="flex flex-col gap-[3px]">
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
        className="w-full rounded-[4px] border border-admin-line bg-admin-surface px-2 py-1.5 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus"
      />
    </div>
  );
}

function Steps({ steps, onChange }: { steps: Step[]; onChange: (steps: Step[]) => void }) {
  const update = (index: number, patch: Partial<Step>): void => {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL}>How the work runs</span>
      {steps.map((step, index) => (
        <div key={index} className="flex flex-wrap gap-2 rounded-[4px] border border-admin-line p-2">
          <input
            aria-label={`Step ${String(index + 1)} name`}
            value={step.title}
            placeholder="Step"
            onChange={(event) => {
              update(index, { title: event.target.value });
            }}
            className={`${INPUT} w-[180px]`}
          />
          <input
            aria-label={`Step ${String(index + 1)} duration`}
            value={step.duration}
            placeholder="How long"
            onChange={(event) => {
              update(index, { duration: event.target.value });
            }}
            className={`${INPUT} w-[120px]`}
          />
          <input
            aria-label={`Step ${String(index + 1)} description`}
            value={step.body}
            placeholder="What happens"
            onChange={(event) => {
              update(index, { body: event.target.value });
            }}
            className={`${INPUT} min-w-[200px] flex-1`}
          />
          <button
            type="button"
            onClick={() => {
              onChange(steps.filter((_, i) => i !== index));
            }}
            className="h-[30px] rounded-[4px] border border-admin-line px-2 text-[11.5px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink"
          >
            Remove
          </button>
        </div>
      ))}
      <div>
        <button
          type="button"
          onClick={() => {
            onChange([...steps, { title: '', duration: '', body: '' }]);
          }}
          className="h-[28px] rounded-[4px] border border-admin-line px-2.5 text-[11.5px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink"
        >
          Add a step
        </button>
      </div>
    </div>
  );
}

