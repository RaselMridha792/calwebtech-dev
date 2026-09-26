'use client';
import type { AdminTestimonial } from '@calwebtech/shared';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { PlusIcon } from '@/components/admin/icons';
import { CHECK, ERROR, HELP, LABEL, SELECT, TAG, button } from '@/components/admin/ui/styles';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { plainErrors } from './plain-errors';
import { Area, Field, Help, Section, StatusPill } from './editor-parts';

/**
 * The client's words on a case study (docs/15-next-tasks.md, task 4; docs/08-decisions.md, 70):
 * its testimonials, each added, changed or removed on its own and audited by the API.
 *
 * A testimonial is shown only with the date the client agreed to publication. The page shows
 * one as its quote and one with a video as its video, featured first; each row says which, as
 * the API worked it out with the page's own queries. Only types come from the shared package,
 * so nothing but this form reaches the browser.
 */

interface Form {
  quote: string;
  clientName: string;
  role: string;
  company: string;
  avatar: string;
  rating: number;
  videoUrl: string;
  featured: boolean;
  consentAt: string;
}

const BLANK: Form = {
  quote: '',
  clientName: '',
  role: '',
  company: '',
  avatar: '',
  rating: 5,
  videoUrl: '',
  featured: false,
  consentAt: '',
};

function toForm(testimonial: AdminTestimonial): Form {
  return {
    quote: testimonial.quote,
    clientName: testimonial.clientName,
    role: testimonial.role ?? '',
    company: testimonial.company ?? '',
    avatar: testimonial.avatar ?? '',
    rating: testimonial.rating,
    videoUrl: testimonial.videoUrl ?? '',
    featured: testimonial.featured,
    consentAt: testimonial.consentAt ?? '',
  };
}

/** What the API reads: an empty box is "none". */
function toBody(form: Form): unknown {
  const text = (value: string): string | null => (value.trim() ? value.trim() : null);
  return {
    quote: form.quote,
    clientName: form.clientName,
    role: text(form.role),
    company: text(form.company),
    avatar: text(form.avatar),
    rating: form.rating,
    videoUrl: text(form.videoUrl),
    featured: form.featured,
    consentAt: text(form.consentAt),
  };
}

function day(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const PLACE: Record<AdminTestimonial['shownAs'][number], string> = {
  quote: 'The page’s quote',
  video: 'The page’s video',
};

export function CaseStudyTestimonials({
  caseStudyId,
  clientName,
  testimonials,
}: {
  /** Null while the case study is not saved yet. */
  caseStudyId: string | null;
  /** The case study's client, offered as the company of a new testimonial. */
  clientName: string;
  testimonials: AdminTestimonial[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const base = `/admin/case-studies/${encodeURIComponent(caseStudyId ?? '')}/testimonials`;

  const done = (message: string): void => {
    setOpen(null);
    setNotice(message);
    router.refresh();
  };

  return (
    <Section
      heading="The client’s words"
      help="The quote and the video on the page. Each is shown only once you enter the date the client agreed to publication; without it, it is kept here and shown nowhere. Each one saves on its own."
    >
      {caseStudyId === null ? (
        <p className={HELP}>Save the draft first. Testimonials can be added once it exists.</p>
      ) : (
        <>
          {notice ? (
            <p
              role="status"
              className="flex items-center gap-2 text-[13.5px] text-ink-invert-muted motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]"
            >
              <span aria-hidden className="size-2 rounded-full bg-result" />
              {notice}
            </p>
          ) : null}

          {testimonials.length === 0 && open !== 'new' ? <p className={HELP}>No testimonial yet.</p> : null}

          {testimonials.length > 0 ? (
            <ul className="flex min-w-0 flex-col gap-3">
              {testimonials.map((testimonial) => (
                <li key={testimonial.id} className="flex min-w-0 flex-col gap-4 rounded-lg border border-admin-line2 bg-admin-sunken p-4">
                  <Summary testimonial={testimonial} />
                  {open === testimonial.id ? (
                    <TestimonialForm
                      key={testimonial.updatedAt}
                      initial={toForm(testimonial)}
                      path={`${base}/${encodeURIComponent(testimonial.id)}`}
                      name={testimonial.clientName}
                      onDone={done}
                      onCancel={() => {
                        setOpen(null);
                      }}
                    />
                  ) : (
                    <div>
                      <button
                        type="button"
                        className={button('secondary', 'sm')}
                        aria-label={`Edit the testimonial from ${testimonial.clientName}`}
                        onClick={() => {
                          setNotice(null);
                          setOpen(testimonial.id);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {open === 'new' ? (
            <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-dashed border-admin-line p-4">
              <p className={LABEL}>New testimonial</p>
              <TestimonialForm
                initial={{ ...BLANK, company: clientName }}
                path={base}
                name={null}
                onDone={done}
                onCancel={() => {
                  setOpen(null);
                }}
              />
            </div>
          ) : (
            <div>
              <button
                type="button"
                className={button('secondary', 'sm')}
                onClick={() => {
                  setNotice(null);
                  setOpen('new');
                }}
              >
                <PlusIcon className="size-4" />
                Add a testimonial
              </button>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

/** Who said it, whether it may be shown, and where the page shows it. */
function Summary({ testimonial }: { testimonial: AdminTestimonial }) {
  const byline = [testimonial.role, testimonial.company].filter(Boolean).join(', ');
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 basis-48 text-[14.5px] font-semibold text-ink-invert">
          {testimonial.clientName}
          {byline ? <span className="font-normal text-admin-muted"> · {byline}</span> : null}
        </p>
        {testimonial.consentAt ? (
          <StatusPill status="PUBLISHED" label={`Consent ${day(testimonial.consentAt)}`} />
        ) : (
          <StatusPill status="DRAFT" label="No consent date: not shown" />
        )}
      </div>
      <p className="line-clamp-2 text-[14px] leading-[1.6] text-ink-invert-muted">“{testimonial.quote}”</p>
      {testimonial.shownAs.length > 0 || testimonial.featured || testimonial.videoUrl ? (
        <div className="flex flex-wrap gap-2">
          {testimonial.shownAs.map((place) => (
            <span key={place} className={TAG}>
              {PLACE[place]}
            </span>
          ))}
          {testimonial.featured ? <span className={TAG}>Featured</span> : null}
          {testimonial.videoUrl ? <span className={TAG}>Has a video</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function TestimonialForm({
  initial,
  path,
  name,
  onDone,
  onCancel,
}: {
  initial: Form;
  /** The testimonial's address for a change, or the list's for a new one. */
  path: string;
  /** The person's name for an existing testimonial; null for a new one. */
  name: string | null;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const set = <K extends keyof Form>(key: K, value: Form[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  function run(kind: 'save' | 'remove', promise: Promise<unknown>, message: string): void {
    setBusy(kind);
    setError(null);
    setFieldErrors({});
    void promise
      .then(() => {
        onDone(message);
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

  const save = (): void => {
    const method = name === null ? 'POST' : 'PATCH';
    run('save', adminMutate(path, { method, body: toBody(form) }), name === null ? 'Testimonial added and audited' : 'Saved and audited');
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Area
        label="What the client said"
        id={`${id}-quote`}
        rows={3}
        value={form.quote}
        errors={fieldErrors.quote}
        onChange={(value) => {
          set('quote', value);
        }}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          id={`${id}-name`}
          value={form.clientName}
          errors={fieldErrors.clientName}
          onChange={(value) => {
            set('clientName', value);
          }}
        />
        <Field
          label="Role"
          id={`${id}-role`}
          value={form.role}
          errors={fieldErrors.role}
          onChange={(value) => {
            set('role', value);
          }}
        />
        <Field
          label="Company"
          id={`${id}-company`}
          value={form.company}
          errors={fieldErrors.company}
          onChange={(value) => {
            set('company', value);
          }}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`${id}-rating`} className={LABEL}>
            Rating
          </label>
          <select
            id={`${id}-rating`}
            value={form.rating}
            onChange={(event) => {
              set('rating', Number(event.target.value));
            }}
            className={SELECT}
          >
            {[5, 4, 3, 2, 1].map((stars) => (
              <option key={stars} value={stars}>
                {`${String(stars)} star${stars === 1 ? '' : 's'}`}
              </option>
            ))}
          </select>
          <Help errors={fieldErrors.rating} />
        </div>
      </div>
      <Field
        label="Portrait"
        id={`${id}-avatar`}
        value={form.avatar}
        errors={fieldErrors.avatar}
        help="Optional. A picture's address from the media library, shown beside the quote."
        onChange={(value) => {
          set('avatar', value);
        }}
      />
      <Field
        label="Video"
        id={`${id}-video`}
        value={form.videoUrl}
        errors={fieldErrors.videoUrl}
        help="Optional. A video file's address (an .mp4 from the media library). The page shows a play button over the case study's cover and loads the video only when it is played."
        onChange={(value) => {
          set('videoUrl', value);
        }}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Client agreed to publication on"
          id={`${id}-consent`}
          type="date"
          value={form.consentAt}
          errors={fieldErrors.consentAt}
          help="Leave empty until they have agreed. Clearing it takes the testimonial off the site."
          onChange={(value) => {
            set('consentAt', value);
          }}
        />
        <label className="flex items-center gap-2.5 self-start text-[14px] text-ink-invert sm:mt-8">
          <input
            type="checkbox"
            className={CHECK}
            checked={form.featured}
            onChange={(event) => {
              set('featured', event.target.checked);
            }}
          />
          Featured: shown before the others
        </label>
      </div>

      {error ? (
        <p role="alert" className={ERROR}>
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy !== null} onClick={save} className={button('secondary')}>
          {busy === 'save' ? 'Working…' : name === null ? 'Add testimonial' : 'Save testimonial'}
        </button>
        <button type="button" disabled={busy !== null} onClick={onCancel} className={button('ghost')}>
          Cancel
        </button>
        {name !== null && !confirming ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setConfirming(true);
            }}
            className={`${button('danger')} sm:ml-auto`}
          >
            Remove
          </button>
        ) : null}
      </div>
      {name !== null && confirming ? (
        <div role="group" aria-label="Confirm removal" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-admin-line2 pt-4">
          <p className="min-w-0 flex-1 basis-60 text-[13.5px] leading-[1.5] text-ink-invert-muted">
            Remove the testimonial from {name}? It comes off the site; the audit log keeps what it said.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              run('remove', adminMutate(path, { method: 'DELETE' }), 'Testimonial removed and audited');
            }}
            className={button('danger', 'sm')}
          >
            {busy === 'remove' ? 'Working…' : 'Yes, remove'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setConfirming(false);
            }}
            className={button('ghost', 'sm')}
          >
            Keep it
          </button>
        </div>
      ) : null}
    </div>
  );
}
