'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { ERROR, LABEL, TEXTAREA, button } from '../ui/styles';

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
    <div className="mt-5 flex flex-col gap-1.5">
      <label htmlFor="lead-note" className={LABEL}>
        Add a note <span className="font-normal text-admin-muted">— type @ to mention a team member</span>
      </label>
      <textarea
        id="lead-note"
        rows={3}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
        }}
        className={TEXTAREA}
      />
      {error ? (
        <p role="alert" className={ERROR}>
          {error}
        </p>
      ) : null}
      <div>
        <button
          type="button"
          onClick={add}
          disabled={busy || body.trim().length === 0}
          className={`${button('secondary', 'sm')} mt-1.5`}
        >
          {busy ? 'Adding…' : 'Add note'}
        </button>
      </div>
    </div>
  );
}
