'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { INPUT, LINK, SELECT, button } from '../ui/styles';

/**
 * The bulk actions, which appear once anything is selected.
 *
 * The checkboxes belong to the table, which is server-rendered; this only watches the form
 * they sit in and counts what is ticked. That keeps the one piece of state on the screen —
 * the selection — out of the table itself.
 *
 * Every option is passed in rather than imported, because a value import from the shared
 * barrel would pull every schema and zod into this bundle.
 */
export function BulkBar({
  containerId,
  owners,
  statuses,
}: {
  /** The element the table's checkboxes sit in. */
  containerId: string;
  owners: { id: string; name: string }[];
  statuses: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return undefined;

    const read = (): void => {
      const boxes = container.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked');
      setSelected([...boxes].map((box) => box.value));
    };
    read();
    container.addEventListener('change', read);
    return () => {
      container.removeEventListener('change', read);
    };
  }, [containerId]);

  if (selected.length === 0) return null;

  const clear = (): void => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked').forEach((box) => {
      box.checked = false;
    });
    container.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const apply = (): void => {
    setBusy(true);
    setError(null);
    void adminMutate('/admin/leads/bulk', {
      method: 'POST',
      body: {
        ids: selected,
        ...(status ? { status } : {}),
        ...(ownerId ? { ownerId: ownerId === 'unassigned' ? null : ownerId } : {}),
        ...(reason ? { reason } : {}),
      },
    })
      .then(() => {
        clear();
        setStatus('');
        setOwnerId('');
        setReason('');
        router.refresh();
      })
      .catch((cause: unknown) => {
        setError(cause instanceof MutationError ? cause.message : 'That could not be applied.');
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const exportUrl = `/api/admin/leads/export?${selected.map((id) => `ids=${encodeURIComponent(id)}`).join('&')}`;

  return (
    <section
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-2.5 rounded-xl border border-admin-edge bg-admin-nav px-4 py-3 motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]"
    >
      <span className="text-[14px] font-bold text-ink-invert">{selected.length} selected</span>
      <span aria-hidden className="h-5 w-px bg-admin-line" />

      <label className="sr-only" htmlFor="bulk-owner">
        Assign owner
      </label>
      <select
        id="bulk-owner"
        value={ownerId}
        onChange={(event) => {
          setOwnerId(event.target.value);
        }}
        className={`${SELECT} w-auto`}
      >
        <option value="">Assign owner…</option>
        <option value="unassigned">Unassigned</option>
        {owners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.name}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="bulk-status">
        Change status
      </label>
      <select
        id="bulk-status"
        value={status}
        onChange={(event) => {
          setStatus(event.target.value);
        }}
        className={`${SELECT} w-auto`}
      >
        <option value="">Change status…</option>
        {statuses.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </select>

      {status ? (
        <>
          <label className="sr-only" htmlFor="bulk-reason">
            Reason for the status change
          </label>
          <input
            id="bulk-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            placeholder="Reason — written to the audit log"
            className={`${INPUT} w-full sm:w-[280px]`}
          />
        </>
      ) : null}

      <button
        type="button"
        onClick={apply}
        disabled={busy || (!status && !ownerId)}
        className={button('primary')}
      >
        {busy ? 'Applying…' : 'Apply'}
      </button>

      <a href={exportUrl} className={button('secondary')}>
        Export selection
      </a>

      {error ? (
        <p role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <button type="button" onClick={clear} className={`${LINK} ml-auto text-[13.5px]`}>
        Deselect
      </button>
    </section>
  );
}

