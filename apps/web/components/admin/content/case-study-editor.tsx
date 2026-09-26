'use client';
import { slugify } from '@calwebtech/shared/slugify';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { ExternalIcon, SortIcon } from '@/components/admin/icons';
import { CHECK, ERROR, HELP, LABEL, SELECT, button, iconButton } from '@/components/admin/ui/styles';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { CopyEditor, type Json } from './copy-editor';
import { Action, Area, Field, Section, StatusPill } from './editor-parts';

/**
 * The case study editor (docs/14-remaining-work.md, task 4; docs/08-decisions.md, 58).
 *
 * The record as a case study page reads it: who the client was and the answer block, what
 * the project touched (industry, services in the page's order, platforms), the figures and
 * pictures, the story in four parts and the search result. A draft saves with the first
 * block alone; the API refuses to publish until the page has three figures.
 *
 * The fields sit in cards down the wide column; publishing has a column of its own on the
 * right from `lg`, where it stays in view, and sits above the fields under that.
 */
export interface CaseStudyRecord {
  title: string;
  slug: string;
  clientName: string;
  clientAlias: string | null;
  summary: string;
  answerBlock: string;
  metrics: Json;
  industryId: string | null;
  services: string[];
  platforms: string[];
  location: string | null;
  segment: string | null;
  duration: string | null;
  year: number | null;
  liveUrl: string | null;
  featured: boolean;
  cover: Json;
  gallery: Json;
  challenge: string | null;
  approach: string | null;
  build: string | null;
  outcome: string | null;
  beforeAfter: Json;
  seo: { title?: string; description?: string; ogImage?: string };
}

export interface CaseStudyDraft {
  id: string | null;
  status: string;
  notReady: string | null;
  shadowsSnapshot: boolean;
  record: CaseStudyRecord;
}

export interface CaseStudyOptions {
  industries: { id: string; name: string }[];
  services: { slug: string; title: string }[];
  platforms: { slug: string; name: string }[];
}

type OptionalText =
  | 'clientAlias'
  | 'location'
  | 'segment'
  | 'duration'
  | 'liveUrl'
  | 'challenge'
  | 'approach'
  | 'build'
  | 'outcome';

export function CaseStudyEditor({
  draft,
  options,
  shapes,
  statusLabels,
}: {
  draft: CaseStudyDraft;
  options: CaseStudyOptions;
  shapes: Record<string, Json>;
  statusLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [record, setRecord] = useState(draft.record);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof CaseStudyRecord>(key: K, value: CaseStudyRecord[K]): void => {
    setRecord((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };
  const text =
    (key: OptionalText) =>
    (value: string): void => {
      set(key, value.trim() ? value : null);
    };

  const body = (): unknown => ({
    ...record,
    slug: record.slug || slugify(record.title),
    seo: Object.fromEntries(Object.entries(record.seo).filter(([, value]) => value.trim())),
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

  const path = (suffix = ''): string => `/admin/case-studies/${encodeURIComponent(draft.id ?? '')}${suffix}`;
  const save = (): void => {
    if (draft.id) {
      run('save', adminMutate(path(), { method: 'PATCH', body: body() }));
      return;
    }
    run('save', adminMutate<{ id: string }>('/admin/case-studies', { method: 'POST', body: body() }), (result) => {
      router.replace(`/admin/case-studies/${(result as { id: string }).id}/`);
    });
  };
  const live = draft.status === 'PUBLISHED';

  // The figures and pictures are edited as one piece of copy, keyed as the API names them.
  const pictures: Json = {
    metrics: record.metrics,
    cover: record.cover,
    gallery: record.gallery,
    beforeAfter: record.beforeAfter,
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:order-last lg:self-start">
        <Section
          heading="Publishing"
          help={
            draft.id
              ? 'Saving keeps your changes here. Publishing is what puts them on the site.'
              : 'Save a draft first. Publishing becomes available once it exists.'
          }
        >
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3 text-[14px]">
              <span className="text-admin-muted">Status</span>
              <StatusPill status={draft.status} label={statusLabels[draft.status] ?? draft.status} />
            </div>
            {draft.notReady ? (
              <p className={HELP}>Before it can be published, it {draft.notReady}.</p>
            ) : draft.shadowsSnapshot ? (
              <p className={HELP}>Visitors still see the site&apos;s built-in page at /work/{record.slug}/ until this is published.</p>
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
                <a href={`/work/${record.slug}/`} target="_blank" rel="noreferrer" className={button('secondary')}>
                  View page
                  <ExternalIcon className="size-4" />
                </a>
              </div>
            ) : null}
          </div>

          {draft.id ? (
            <div className="flex flex-col gap-2 border-t border-admin-line2 pt-4">
              <button
                type="button"
                disabled={busy === 'delete'}
                onClick={() => {
                  run('delete', adminMutate(path(), { method: 'DELETE' }), () => {
                    router.replace('/admin/case-studies/');
                  });
                }}
                className={`${button('danger')} self-start`}
              >
                {busy === 'delete' ? 'Working…' : 'Delete this case study'}
              </button>
              <p className={HELP}>
                The record is kept so its history still names it, and a published address keeps working by
                redirecting to /work/.
              </p>
            </div>
          ) : null}
        </Section>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <Section heading="Basics" help="What the page is called, where it lives on the site, and the two lines it opens with.">
          <Field
            label="Title"
            id="cs-title"
            value={record.title}
            errors={fieldErrors.title}
            help="The page's main heading, written for the search it should answer."
            onChange={(value) => {
              setRecord((current) => ({
                ...current,
                title: value,
                slug: current.slug === slugify(current.title) ? slugify(value) : current.slug,
              }));
              setSaved(false);
            }}
          />
          <Field
            label="Address"
            id="cs-slug"
            prefix="/work/"
            value={record.slug}
            errors={fieldErrors.slug}
            help={
              live
                ? 'This page is published. Changing its address sends the old one to the new one automatically, so no link breaks.'
                : 'Follows the title until you change it. Lower-case words joined with hyphens.'
            }
            onChange={(value) => {
              set('slug', value);
            }}
          />
          <Area
            label="Summary"
            id="cs-summary"
            rows={2}
            value={record.summary}
            errors={fieldErrors.summary}
            help="One line, on the case study's card."
            onChange={(value) => {
              set('summary', value);
            }}
          />
          <Area
            label="Answer block"
            id="cs-answer"
            rows={3}
            value={record.answerBlock}
            errors={fieldErrors.answerBlock}
            help="Two or three sentences: the problem, what was built, what changed. This is what an answer engine quotes."
            onChange={(value) => {
              set('answerBlock', value);
            }}
          />
        </Section>

        <Section heading="The client" help="Who the work was for, and the facts shown beside the case study.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Client"
              id="cs-client"
              value={record.clientName}
              errors={fieldErrors.clientName}
              onChange={(value) => {
                set('clientName', value);
              }}
            />
            <Field
              label="Shown as, when the name cannot be published"
              id="cs-alias"
              value={record.clientAlias ?? ''}
              errors={fieldErrors.clientAlias}
              onChange={text('clientAlias')}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Location"
              id="cs-location"
              value={record.location ?? ''}
              errors={fieldErrors.location}
              onChange={text('location')}
            />
            <Field
              label="Segment"
              id="cs-segment"
              value={record.segment ?? ''}
              errors={fieldErrors.segment}
              help="Comma separated; each part is a tag on the card, e.g. B2B, Distribution."
              onChange={text('segment')}
            />
            <Field
              label="Duration"
              id="cs-duration"
              value={record.duration ?? ''}
              errors={fieldErrors.duration}
              onChange={text('duration')}
            />
            <Field
              label="Year"
              id="cs-year"
              type="number"
              value={record.year === null ? '' : String(record.year)}
              errors={fieldErrors.year}
              onChange={(value) => {
                set('year', value.trim() ? Number(value) : null);
              }}
            />
            <Field
              label="Live site"
              id="cs-live"
              value={record.liveUrl ?? ''}
              errors={fieldErrors.liveUrl}
              help="The full address, starting https://."
              onChange={text('liveUrl')}
            />
          </div>
          <label className="flex items-center gap-2.5 text-[14px] text-ink-invert">
            <input
              type="checkbox"
              className={CHECK}
              checked={record.featured}
              onChange={(event) => {
                set('featured', event.target.checked);
              }}
            />
            Featured: listed first on /work/
          </label>
        </Section>

        <Section
          heading="Services and industry"
          help="What the project touched. Each is a filter on /work/ and a link on the page."
        >
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="cs-industry" className={LABEL}>
              Industry
            </label>
            <select
              id="cs-industry"
              value={record.industryId ?? ''}
              onChange={(event) => {
                set('industryId', event.target.value || null);
              }}
              className={SELECT}
            >
              <option value="">No industry</option>
              {options.industries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </select>
          </div>
          <OrderedPicker
            label="Services, in the order the page lists them"
            noun="a service"
            chosen={record.services}
            options={options.services.map((service) => ({ value: service.slug, label: service.title }))}
            onChange={(values) => {
              set('services', values);
            }}
            errors={fieldErrors.services}
          />
          <OrderedPicker
            label="Platforms"
            noun="a platform"
            chosen={record.platforms}
            options={options.platforms.map((platform) => ({ value: platform.slug, label: platform.name }))}
            onChange={(values) => {
              set('platforms', values);
            }}
            errors={fieldErrors.platforms}
          />
        </Section>

        <Section
          heading="Figures and pictures"
          help="The first figure is the headline. A case study is published with at least three. Every picture needs a description."
        >
          <CopyEditor
            value={pictures}
            onChange={(value) => {
              const next = value as { metrics: Json; cover: Json; gallery: Json; beforeAfter: Json };
              setRecord((current) => ({ ...current, ...next }));
              setSaved(false);
            }}
            errors={fieldErrors}
            shapes={shapes}
            level={3}
          />
        </Section>

        <Section heading="The story" help="Paragraphs separated by a blank line. A part left empty is left out of the page.">
          <Area
            label="The challenge"
            id="cs-challenge"
            rows={4}
            value={record.challenge ?? ''}
            errors={fieldErrors.challenge}
            onChange={text('challenge')}
          />
          <Area
            label="The approach"
            id="cs-approach"
            rows={4}
            value={record.approach ?? ''}
            errors={fieldErrors.approach}
            onChange={text('approach')}
          />
          <Area
            label="What was built"
            id="cs-build"
            rows={4}
            value={record.build ?? ''}
            errors={fieldErrors.build}
            onChange={text('build')}
          />
          <Area
            label="The outcome"
            id="cs-outcome"
            rows={4}
            value={record.outcome ?? ''}
            errors={fieldErrors.outcome}
            onChange={text('outcome')}
          />
        </Section>

        <Section
          heading="Search result"
          help="How the page reads in search and when it is shared. Each falls back to the page's own words."
        >
          <Field
            label={`Title (${String(record.seo.title?.length ?? 0)}/60)`}
            id="cs-seo-title"
            value={record.seo.title ?? ''}
            errors={fieldErrors['seo.title']}
            onChange={(value) => {
              set('seo', { ...record.seo, title: value });
            }}
          />
          <Area
            label={`Description (${String(record.seo.description?.length ?? 0)}/155)`}
            id="cs-seo-description"
            rows={2}
            value={record.seo.description ?? ''}
            errors={fieldErrors['seo.description']}
            onChange={(value) => {
              set('seo', { ...record.seo, description: value });
            }}
          />
          <Field
            label="Share image"
            id="cs-seo-image"
            value={record.seo.ogImage ?? ''}
            errors={fieldErrors['seo.ogImage']}
            help="An address from the media library. Empty uses the cover."
            onChange={(value) => {
              set('seo', { ...record.seo, ogImage: value });
            }}
          />
        </Section>
      </div>
    </div>
  );
}

/** A chosen list in an order that matters: add from the rest, move, remove. */
function OrderedPicker({
  label,
  noun,
  chosen,
  options,
  onChange,
  errors,
}: {
  label: string;
  /** What one entry is called on the add control: "a service". */
  noun: string;
  chosen: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
  errors?: string[];
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const name = (value: string): string => options.find((option) => option.value === value)?.label ?? value;
  const rest = options.filter((option) => !chosen.includes(option.value));
  const move = (from: number, to: number): void => {
    const next = [...chosen];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div role="group" aria-labelledby={labelId} className="flex min-w-0 flex-col gap-2">
      <p id={labelId} className={LABEL}>
        {label}
      </p>
      {chosen.length === 0 ? (
        <p className={HELP}>None chosen.</p>
      ) : (
        <ol className="flex min-w-0 flex-col gap-2">
          {chosen.map((value, index) => (
            <li
              key={value}
              className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-admin-line2 bg-admin-sunken py-2 pr-2 pl-3"
            >
              <span className="min-w-0 flex-1 basis-40 text-[14px] text-ink-invert">
                <span className="mr-2 text-[12.5px] text-admin-muted tabular-nums">{String(index + 1)}.</span>
                {name(value)}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className={iconButton('sm')}
                  disabled={index === 0}
                  aria-label={`Move ${name(value)} up`}
                  onClick={() => {
                    move(index, index - 1);
                  }}
                >
                  <SortIcon direction="asc" className="size-4" />
                </button>
                <button
                  type="button"
                  className={iconButton('sm')}
                  disabled={index === chosen.length - 1}
                  aria-label={`Move ${name(value)} down`}
                  onClick={() => {
                    move(index, index + 1);
                  }}
                >
                  <SortIcon direction="desc" className="size-4" />
                </button>
                <button
                  type="button"
                  className={button('ghost', 'sm')}
                  aria-label={`Remove ${name(value)}`}
                  onClick={() => {
                    onChange(chosen.filter((entry) => entry !== value));
                  }}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
      {rest.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={id} className={LABEL}>
            Add {noun}
          </label>
          <select
            id={id}
            value=""
            onChange={(event) => {
              if (event.target.value) onChange([...chosen, event.target.value]);
            }}
            className={SELECT}
          >
            <option value="">Choose one to add</option>
            {rest.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {errors?.length ? (
        <p role="alert" className={ERROR}>
          {errors.join(' ')}
        </p>
      ) : null}
    </div>
  );
}
