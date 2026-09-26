'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CARD, CARD_PAD, ERROR, H2, HELP, INPUT, LABEL, button } from '@/components/admin/ui/styles';
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
      noValidate
      aria-labelledby="suppression-form-title"
      className={`${CARD} ${CARD_PAD}`}
    >
      <div className="mb-5 flex flex-col gap-1">
        <h2 id="suppression-form-title" className={H2}>
          Block an address by hand
        </h2>
        <p className="text-[13.5px] leading-[1.55] text-ink-invert-muted">
          Once an address is on this list, nothing in the dashboard can ever take it off again, so check the spelling
          before you confirm. You will be asked once.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="suppression-email" className={LABEL}>
          Email address
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="suppression-email"
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
            className={`${INPUT} min-w-55 flex-1 sm:max-w-105`}
          />
          <button type="submit" disabled={busy || !email.trim()} className={button('primary')}>
            {busy ? 'Adding…' : confirming ? 'Yes, suppress it' : 'Add'}
          </button>
          {confirming && !busy ? (
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
              }}
              className={button('secondary')}
            >
              Cancel
            </button>
          ) : null}
        </div>

        {error ? (
          <p id="suppression-error" role="alert" className={ERROR}>
            {error}
          </p>
        ) : (
          <p
            id="suppression-help"
            className={`flex items-center gap-2 ${added ? 'text-[13px] text-ink-invert-muted motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]' : HELP}`}
            aria-live="polite"
          >
            {added ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-result" /> : null}
            {added
              ? `${added} is on the list. No campaign will reach it.`
              : confirming
                ? 'Once added, the address cannot be taken off the list from the dashboard.'
                : 'For somebody who asked, by phone or by email, not to be written to.'}
          </p>
        )}
      </div>
    </form>
  );
}
