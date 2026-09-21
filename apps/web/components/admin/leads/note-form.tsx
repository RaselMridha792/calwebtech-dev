'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';

/**
 * A note on the lead. Notes are what turn a status history into a record someone else can
 * pick up, so this sits directly under the timeline it adds to.
 */
export function NoteForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function add(): void {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    void adminMutate(`/admin/leads/${encodeURIComponent(leadId)}/notes`, { method: 'POST', body: { body: text } })
      .then(() => {
        setBody('');
        router.refresh();
      })
      .catch((cause: unknown) => {
        setError(cause instanceof MutationError ? cause.message : 'That note could not be added.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="mt-3 flex flex-col gap-[3px]">
      <label htmlFor="lead-note" className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
        Add a note — type @ to mention a team member
      </label>
      <textarea
        id="lead-note"
        rows={2}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
        }}
        className="rounded-[4px] border border-admin-line bg-admin-surface px-2 py-1.5 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus"
      />
      {error ? (
        <p role="alert" className="text-[11px] text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <button
          type="button"
          onClick={add}
          disabled={busy || body.trim().length === 0}
          className="mt-1.5 h-[29px] rounded-[4px] border border-admin-line px-3 text-[12px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink disabled:opacity-40"
        >
          {busy ? 'Adding…' : 'Add note'}
        </button>
      </div>
    </div>
  );
}
