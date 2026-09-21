'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';

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
      className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-admin-line bg-admin-mist px-4 py-2"
    >
      <span className="text-[12.5px] font-bold text-admin-ink">{selected.length} selected</span>
      <span aria-hidden className="h-[18px] w-px bg-admin-line" />

      <label className="sr-only" htmlFor="bulk-owner">
        Assign owner
      </label>
      <select
        id="bulk-owner"
        value={ownerId}
        onChange={(event) => {
          setOwnerId(event.target.value);
        }}
        className={CONTROL}
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
        className={CONTROL}
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
            className={`${CONTROL} w-[260px]`}
          />
        </>
      ) : null}

      <button
        type="button"
        onClick={apply}
        disabled={busy || (!status && !ownerId)}
        className="h-[29px] rounded-[4px] bg-primary px-3 text-[12px] font-semibold text-white hover:bg-admin-primaryh disabled:opacity-40"
      >
        {busy ? 'Applying…' : 'Apply'}
      </button>

      <a href={exportUrl} className={`${CONTROL} flex items-center`}>
        Export selection
      </a>

      {error ? (
        <p role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      <button type="button" onClick={clear} className="ml-auto text-[12px] font-semibold text-admin-link underline">
        Deselect
      </button>
    </section>
  );
}

const CONTROL =
  'h-[29px] rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12px] font-semibold text-admin-body outline-none hover:border-admin-focus hover:text-admin-ink focus-visible:border-admin-focus';
