'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';

/**
 * Adds an address to the suppression list by hand. It asks once before saving, because
 * nothing on this screen can undo it.
 */
export function SuppressionForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  function submit(): void {
    if (!email.trim()) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setError(null);
    void adminMutate('/admin/suppressions', { method: 'POST', body: { email } })
      .then(() => {
        setAdded(email.trim().toLowerCase());
        setEmail('');
        setConfirming(false);
        router.refresh();
      })
      .catch((cause: unknown) => {
        if (cause instanceof MutationError) setError(cause.fieldErrors.email?.[0] ?? cause.message);
        else setError('That could not be saved.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      noValidate className="mb-5 border-b border-admin-line pb-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[240px] flex-1 flex-col gap-[3px]">
          <span className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">Suppress an address</span>
          <input
            type="email"
            value={email}
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'suppression-error' : 'suppression-help'}
            onChange={(event) => {
              setEmail(event.target.value);
              setConfirming(false);
              setAdded(null);
            }}
            placeholder="name@example.com"
            className={`h-[30px] w-full rounded-[4px] border bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus ${
              error ? 'border-danger' : 'border-admin-line'
            }`}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="h-8 rounded-[4px] bg-primary px-4 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh disabled:opacity-40"
        >
          {busy ? 'Adding…' : confirming ? 'Yes, suppress it' : 'Add'}
        </button>
        {confirming && !busy ? (
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
            }}
            className="h-8 rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {error ? (
        <p id="suppression-error" role="alert" className="mt-2 text-[12.5px] text-danger">
          {error}
        </p>
      ) : (
        <p id="suppression-help" className="mt-2 text-[11.5px] text-admin-muted" aria-live="polite">
          {added
            ? `${added} is on the list. No campaign will reach it.`
            : confirming
              ? 'Once added, the address cannot be taken off the list from the dashboard.'
              : 'For somebody who asked, by phone or by email, not to be written to.'}
        </p>
      )}
    </form>
  );
}
