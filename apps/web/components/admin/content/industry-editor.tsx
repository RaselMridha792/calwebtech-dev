'use client';
import { slugify } from '@calwebtech/shared/slugify';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { CopyEditor, ordered, type Json } from './copy-editor';
import { Action, Area, Field, Section } from './editor-parts';

/**
 * The industry editor (docs/14-remaining-work.md, task 4; docs/08-decisions.md, 58).
 *
 * The record's own fields first — name, address, answer block, card line — then the page's
 * copy, the questions and the search result. A new industry can be saved with the first
 * three alone; its page then shows the hero and the answer block until copy is added, which
 * starts from the template's headings rather than an empty box.
 *
 * Publishing is a separate action from saving, as in the service editor.
 */
export interface IndustryDraft {
  id: string | null;
  name: string;
  slug: string;
  answerBlock: string;
  heroCopy: string;
  order: number;
  seoTitle: string;
  seoDescription: string;
  seoOgImage: string;
  content: Json | null;
  faqs: { question: string; answer: string }[];
  status: string;
  shadowsSnapshot: boolean;
}

export function IndustryEditor({
  draft,
  template,
  shapes,
  statusLabels,
}: {
  draft: IndustryDraft;
  /** The copy a page starts from: the template's headings and empty items. */
  template: Json;
  shapes: Record<string, Json>;
  statusLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => ({
    ...draft,
    content: draft.content === null ? null : ordered(draft.content, template),
  }));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof IndustryDraft>(key: K, value: IndustryDraft[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const body = (): unknown => ({
    name: form.name,
    slug: form.slug || slugify(form.name),
    answerBlock: form.answerBlock,
    heroCopy: form.heroCopy.trim() || null,
    order: form.order,
    seo: {
      ...(form.seoTitle.trim() ? { title: form.seoTitle.trim() } : {}),
      ...(form.seoDescription.trim() ? { description: form.seoDescription.trim() } : {}),
      ...(form.seoOgImage.trim() ? { ogImage: form.seoOgImage.trim() } : {}),
    },
    content: form.content,
    faqs: form.faqs.filter((faq) => faq.question.trim() || faq.answer.trim()),
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
          setError(perField ? 'Some fields need attention; each says why below.' : cause.message);
          setFieldErrors(cause.fieldErrors);
        } else setError('That could not be saved.');
      })
      .finally(() => {
        setBusy(null);
      });
  }

  const path = (suffix = ''): string => `/admin/industries/${encodeURIComponent(form.id ?? '')}${suffix}`;

  const save = (): void => {
    if (form.id) {
      run('save', adminMutate(path(), { method: 'PATCH', body: body() }));
      return;
    }
    run('save', adminMutate<{ id: string }>('/admin/industries', { method: 'POST', body: body() }), (result) => {
      router.replace(`/admin/industries/${(result as { id: string }).id}/`);
    });
  };

  const live = form.status === 'PUBLISHED';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2.5 rounded-[4px] border border-admin-line bg-admin-sunken px-3 py-2.5">
        <span className="text-[12.5px] font-semibold text-admin-ink">{statusLabels[form.status] ?? form.status}</span>
        {form.shadowsSnapshot ? (
          <span className="text-[11.5px] text-admin-muted">
            /industries/{form.slug}/ is still served from the committed snapshot until this is published.
          </span>
        ) : null}
        <span className="ml-auto flex flex-wrap gap-2">
          <Action busy={busy === 'save'} primary onClick={save}>
            {form.id ? 'Save' : 'Create draft'}
          </Action>
          {form.id ? (
            <Action
              busy={busy === 'publish'}
              onClick={() => {
                run('publish', adminMutate(path(live ? '/unpublish' : '/publish'), { method: 'POST' }));
              }}
            >
              {live ? 'Unpublish' : 'Publish'}
            </Action>
          ) : null}
          {form.id ? (
            <a
              href={`/industries/${form.slug}/`}
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

      <Section heading="The industry">
        <Field
          label="Name"
          id="ind-name"
          value={form.name}
          errors={fieldErrors.name}
          onChange={(value) => {
            setForm((current) => ({
              ...current,
              name: value,
              // The address follows the name until someone edits it: a published slug that
              // changes leaves a redirect behind.
              slug: current.slug === slugify(current.name) ? slugify(value) : current.slug,
            }));
            setSaved(false);
          }}
        />
        <Field
          label="Address"
          id="ind-slug"
          value={form.slug}
          errors={fieldErrors.slug}
          prefix="/industries/"
          onChange={(value) => {
            set('slug', value);
          }}
          help={live ? 'Changing this leaves a permanent redirect from the old address.' : undefined}
        />
        <Area
          label="Answer block"
          id="ind-answer"
          rows={3}
          value={form.answerBlock}
          errors={fieldErrors.answerBlock}
          help="Two or three sentences answering the page's question directly, before any marketing. This is what an answer engine quotes."
          onChange={(value) => {
            set('answerBlock', value);
          }}
        />
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[240px] flex-1">
            <Field
              label="Card line"
              id="ind-line"
              value={form.heroCopy}
              errors={fieldErrors.heroCopy}
              help="One line on the industry's card on /industries/ and over its highlights."
              onChange={(value) => {
                set('heroCopy', value);
              }}
            />
          </div>
          <Field
            label="Order"
            id="ind-order"
            type="number"
            narrow
            value={String(form.order)}
            errors={fieldErrors.order}
            onChange={(value) => {
              set('order', Number(value) || 0);
            }}
          />
        </div>
      </Section>

      <Section
        heading="The page"
        help="The words on the page, section by section. The layout is fixed by the template; a section with nothing in it is left out."
      >
        {form.content === null ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12px] text-admin-body">
              No page copy yet: the page shows its heading and answer block alone.
            </p>
            <button
              type="button"
              className="h-[28px] rounded-[4px] border border-admin-line px-2.5 text-[11.5px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink"
              onClick={() => {
                set('content', structuredClone(template));
              }}
            >
              Start the page copy
            </button>
          </div>
        ) : (
          <>
            <CopyEditor
              value={form.content}
              onChange={(value) => {
                set('content', value);
              }}
              errors={fieldErrors}
              errorPrefix="content"
              shapes={shapes}
            />
            <div>
              <button
                type="button"
                className="h-[26px] rounded-[4px] border border-admin-line px-2 text-[11px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink"
                onClick={() => {
                  set('content', null);
                }}
              >
                Remove the page copy
              </button>
            </div>
          </>
        )}
      </Section>

      <Section heading="Questions" help="Shown on the page as its FAQ, in this order, and marked up for search.">
        {form.faqs.map((faq, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-[4px] border border-admin-line p-3">
            <Field
              label={`Question ${String(index + 1)}`}
              id={`ind-faq-${String(index)}-q`}
              value={faq.question}
              errors={fieldErrors[`faqs.${String(index)}.question`]}
              onChange={(value) => {
                set(
                  'faqs',
                  form.faqs.map((entry, i) => (i === index ? { ...entry, question: value } : entry)),
                );
              }}
            />
            <Area
              label="Answer"
              id={`ind-faq-${String(index)}-a`}
              rows={3}
              value={faq.answer}
              errors={fieldErrors[`faqs.${String(index)}.answer`]}
              onChange={(value) => {
                set(
                  'faqs',
                  form.faqs.map((entry, i) => (i === index ? { ...entry, answer: value } : entry)),
                );
              }}
            />
            <div>
              <button
                type="button"
                className="h-[26px] rounded-[4px] border border-admin-line px-2 text-[11px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink"
                onClick={() => {
                  set(
                    'faqs',
                    form.faqs.filter((_, i) => i !== index),
                  );
                }}
              >
                Remove this question
              </button>
            </div>
          </div>
        ))}
        <div>
          <button
            type="button"
            disabled={form.faqs.length >= 6}
            className="h-[28px] rounded-[4px] border border-admin-line px-2.5 text-[11.5px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink disabled:opacity-40"
            onClick={() => {
              set('faqs', [...form.faqs, { question: '', answer: '' }]);
            }}
          >
            Add a question
          </button>
        </div>
      </Section>

      <Section heading="Search result" help="How the page reads in search and when it is shared. Each falls back to the page's own words.">
        <Field
          label={`Title (${String(form.seoTitle.length)}/60)`}
          id="ind-seo-title"
          value={form.seoTitle}
          errors={fieldErrors['seo.title']}
          onChange={(value) => {
            set('seoTitle', value);
          }}
        />
        <Area
          label={`Description (${String(form.seoDescription.length)}/155)`}
          id="ind-seo-description"
          rows={2}
          value={form.seoDescription}
          errors={fieldErrors['seo.description']}
          onChange={(value) => {
            set('seoDescription', value);
          }}
        />
        <Field
          label="Share image"
          id="ind-seo-image"
          value={form.seoOgImage}
          errors={fieldErrors['seo.ogImage']}
          help="An address from the media library. Empty uses the industry's photograph."
          onChange={(value) => {
            set('seoOgImage', value);
          }}
        />
      </Section>

      {form.id ? (
        <div className="border-t border-admin-line pt-4">
          <Action
            busy={busy === 'delete'}
            onClick={() => {
              run('delete', adminMutate(path(), { method: 'DELETE' }), () => {
                router.replace('/admin/industries/');
              });
            }}
          >
            Delete this industry
          </Action>
          <p className="mt-1.5 text-[11px] text-admin-muted">
            The record is kept so its history still names it, and a published address keeps working by redirecting to
            the industries index.
          </p>
        </div>
      ) : null}
    </div>
  );
}
