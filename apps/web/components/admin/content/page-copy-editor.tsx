'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { CopyEditor, type Json } from './copy-editor';
import { Action } from './editor-parts';

/**
 * One piece of page copy (docs/14-remaining-work.md, task 4; docs/08-decisions.md, 59): the
 * homepage, the booking page, the thank-you pages or an index's copy, as fields. Saving sends
 * the whole value; the API checks it with the page's own schema and names every field it
 * refuses, and the change is audited with the sections it touched.
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2.5 rounded-[4px] border border-admin-line bg-admin-sunken px-3 py-2.5">
        <span className="text-[11.5px] text-admin-muted">{liveNote}</span>
        <span className="ml-auto">
          <Action busy={busy} primary onClick={save}>
            Save
          </Action>
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
      <CopyEditor
        value={copy}
        onChange={(next) => {
          setCopy(next);
          setSaved(false);
        }}
        errors={fieldErrors}
      />
      <div className="border-t border-admin-line pt-4">
        <Action busy={busy} primary onClick={save}>
          Save
        </Action>
      </div>
    </div>
  );
}
