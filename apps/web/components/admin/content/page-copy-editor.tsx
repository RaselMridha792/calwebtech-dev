'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ERROR, HELP } from '@/components/admin/ui/styles';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { CopyEditor, type Json } from './copy-editor';
import { Action, Section } from './editor-parts';

/**
 * One piece of page copy (docs/14-remaining-work.md, task 4; docs/08-decisions.md, 59): the
 * homepage, the booking page, the thank-you pages or an index's copy, as fields. Saving sends
 * the whole value; the API checks it with the page's own schema and names every field it
 * refuses, and the change is audited with the sections it touched.
 *
 * The fields take the wide column and the save panel keeps them company on the right from
 * `lg`, where it stays in view however long the page is. Under that it sits above the
 * fields, and a second save waits at the end so a phone never has to scroll back up.
 */
export function PageCopyEditor({ copyKey, value, liveNote }: { copyKey: string; value: Json; liveNote: string }) {
  const router = useRouter();
  const [copy, setCopy] = useState<Json>(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);

  const save = (): void => {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    void adminMutate(`/admin/page-copy/${encodeURIComponent(copyKey)}`, { method: 'PUT', body: { value: copy } })
      .then(() => {
        setSaved(true);
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
        setBusy(false);
      });
  };

  const feedback = error ? (
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
  ) : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:order-last lg:self-start">
        <Section heading="Save changes" help={liveNote}>
          {feedback}
          <div className="flex flex-col gap-2">
            <Action busy={busy} primary onClick={save}>
              Save
            </Action>
          </div>
          <p className={HELP}>
            Every change is checked against the page before it is stored, and written to the audit log. A field the
            page refuses says why, under the field.
          </p>
        </Section>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <CopyEditor
          value={copy}
          onChange={(next) => {
            setCopy(next);
            setSaved(false);
          }}
          errors={fieldErrors}
        />
        <div className="flex flex-col gap-3 lg:hidden">
          {feedback}
          <Action busy={busy} primary onClick={save}>
            Save
          </Action>
        </div>
      </div>
    </div>
  );
}
