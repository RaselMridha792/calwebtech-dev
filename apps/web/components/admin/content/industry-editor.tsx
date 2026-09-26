'use client';
import { slugify } from '@calwebtech/shared/slugify';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ExternalIcon, PlusIcon } from '@/components/admin/icons';
import { ERROR, HELP, KICKER, TEXTAREA, button } from '@/components/admin/ui/styles';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { CopyEditor, ordered, type Json } from './copy-editor';
import { Action, Area, Field, Help, INPUT, LABEL, Section, StatusPill } from './editor-parts';

/**
 * The industry editor (docs/14-remaining-work.md, task 4; docs/08-decisions.md, 58).
 *
 * The record's own fields first — name, address, card line, answer block — then the page's
 * copy and the questions. A new industry can be saved with the first three alone; its page
 * then shows the hero and the answer block until copy is added, which starts from the
 * template's headings rather than an empty box.
 *
 * Publishing is a separate action from saving, as in the service editor, and the same
 * column on the right holds it, with the search result under it.
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
  const answerLength = form.answerBlock.trim().length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Section heading="Basics" help="What the industry is called, where its page lives on the site, and the line on its card.">
          <Field
            label="Name"
            id="ind-name"
            value={form.name}
            errors={fieldErrors.name}
            help="As it appears on the industries index and at the top of the page."
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
            help={
              live
                ? 'This page is published. Changing its address sends the old one to the new one automatically, so no link breaks.'
                : 'Follows the name until you change it. Lower-case words joined with hyphens.'
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
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
            <Field
              label="Order"
              id="ind-order"
              type="number"
              value={String(form.order)}
              errors={fieldErrors.order}
              help="Lower comes first."
              onChange={(value) => {
                set('order', Number(value) || 0);
              }}
            />
          </div>
        </Section>

        <Section
          heading="Answer block"
          help="The first thing on the page: a direct answer to the question the page is about, before any selling. Search engines and AI assistants quote this part, so every page needs one."
        >
          <Area
            label="Answer block"
            id="ind-answer"
            rows={4}
            value={form.answerBlock}
            errors={fieldErrors.answerBlock}
            help={`Two or three complete sentences: what this industry needs from a website and what they get. ${String(answerLength)} characters so far, between 80 and 600 is right.`}
            onChange={(value) => {
              set('answerBlock', value);
            }}
          />
        </Section>

        <Section
          heading="The page"
          help="The words on the page, section by section. The layout is fixed by the template; a section with nothing in it is left out."
        >
          {form.content === null ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-admin-line px-4 py-4">
              <p className="text-[14px] leading-[1.6] text-ink-invert-muted">
                No page copy yet: the page shows its heading and answer block alone. Start the copy and every section
                appears with a suggested heading to fill in.
              </p>
              <button
                type="button"
                className={button('secondary', 'sm')}
                onClick={() => {
                  set('content', structuredClone(template));
                }}
              >
                <PlusIcon className="size-4" />
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
              <div className="flex flex-col gap-2 border-t border-admin-line2 pt-4">
                <button
                  type="button"
                  className={`${button('danger', 'sm')} self-start`}
                  onClick={() => {
                    set('content', null);
                  }}
                >
                  Remove the page copy
                </button>
                <p className={HELP}>Takes every section off the page, leaving the heading and answer block. Nothing is lost until you save.</p>
              </div>
            </>
          )}
        </Section>

        <Section
          heading="Questions and answers"
          help="Shown at the foot of the page as its FAQ, in this order, and marked up so search engines can show them too."
        >
          {form.faqs.length === 0 ? <p className={HELP}>No questions yet, so the page leaves this section out.</p> : null}
          {form.faqs.map((faq, index) => (
            <div key={index} className="flex flex-col gap-4 rounded-lg border border-admin-line2 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <span className={KICKER}>Question {index + 1}</span>
                <button
                  type="button"
                  className={button('ghost', 'sm')}
                  onClick={() => {
                    set(
                      'faqs',
                      form.faqs.filter((_, i) => i !== index),
                    );
                  }}
                >
                  Remove
                </button>
              </div>
              <Field
                label="Question"
                id={`ind-faq-${String(index)}-q`}
                value={faq.question}
                errors={fieldErrors[`faqs.${String(index)}.question`]}
                help="As a buyer would type it, ending in a question mark."
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
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={form.faqs.length >= 6}
              className={button('secondary', 'sm')}
              onClick={() => {
                set('faqs', [...form.faqs, { question: '', answer: '' }]);
              }}
            >
              <PlusIcon className="size-4" />
              Add a question
            </button>
            <span className={HELP}>Up to six.</span>
          </div>
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
                Visitors still see the site&apos;s built-in page at /industries/{form.slug}/ until this is published.
              </p>
            ) : null}
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
                <Action
                  busy={busy === 'publish'}
                  onClick={() => {
                    run('publish', adminMutate(path(live ? '/unpublish' : '/publish'), { method: 'POST' }));
                  }}
                >
                  {live ? 'Unpublish' : 'Publish'}
                </Action>
                <a href={`/industries/${form.slug}/`} target="_blank" rel="noreferrer" className={button('secondary')}>
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
                  run('delete', adminMutate(path(), { method: 'DELETE' }), () => {
                    router.replace('/admin/industries/');
                  });
                }}
                className={`${button('danger')} self-start`}
              >
                {busy === 'delete' ? 'Working…' : 'Delete this industry'}
              </button>
              <p className={HELP}>
                The record is kept so its history still names it, and a published address keeps working by
                redirecting to the industries index.
              </p>
            </div>
          ) : null}
        </Section>

        <Section
          heading="Search result"
          help="How the page reads in Google and when it is shared. Each falls back to the page's own words when left empty."
        >
          <Counted
            label="Title"
            id="ind-seo-title"
            max={60}
            value={form.seoTitle}
            errors={fieldErrors['seo.title']}
            onChange={(value) => {
              set('seoTitle', value);
            }}
          />
          <Counted
            label="Description"
            id="ind-seo-description"
            max={155}
            rows={3}
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
