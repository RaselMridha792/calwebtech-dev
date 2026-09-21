'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';

/**
 * Status, owner and next action date, saved as one pipeline change.
 *
 * A reason is required whenever the status moves, and the field says why: it is quoted on
 * the timeline and written to the audit log, so a lead's history reads as decisions rather
 * than as a list of values that changed.
 *
 * `expectedStatus` is sent with the change. If someone else moved the lead while this panel
 * was open the API answers 409 and nothing is overwritten.
 */
export function PipelineForm({
  leadId,
  status,
  statuses,
  ownerId,
  owners,
  nextActionDate,
}: {
  leadId: string;
  status: string;
  statuses: { value: string; label: string }[];
  ownerId: string;
  owners: { id: string; name: string }[];
  nextActionDate: string;
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status);
  const [nextOwner, setNextOwner] = useState(ownerId);
  const [nextDate, setNextDate] = useState(nextActionDate);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const statusMoved = nextStatus !== status;
  const changed = statusMoved || nextOwner !== ownerId || nextDate !== nextActionDate;
  const reasonMissing = Boolean(error) && statusMoved && reason.trim().length === 0;

  function save(): void {
    if (statusMoved && reason.trim().length === 0) {
      setError('Add a reason before saving. Every status change is attributed in the audit log.');
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    void adminMutate(`/admin/leads/${encodeURIComponent(leadId)}/pipeline`, {
      method: 'PATCH',
      body: {
        ...(statusMoved ? { status: nextStatus, expectedStatus: status } : {}),
        ...(nextOwner !== ownerId ? { ownerId: nextOwner === '' ? null : nextOwner } : {}),
        ...(nextDate !== nextActionDate ? { nextActionDate: nextDate === '' ? null : nextDate } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      },
    })
      .then(() => {
        setSaved(true);
        setReason('');
        router.refresh();
      })
      .catch((cause: unknown) => {
        setError(cause instanceof MutationError ? cause.message : 'That could not be saved.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2.5">
        <Control label="Status" htmlFor="pipeline-status">
          <select
            id="pipeline-status"
            value={nextStatus}
            onChange={(event) => {
              setNextStatus(event.target.value);
              setSaved(false);
            }}
            className={INPUT}
          >
            {statuses.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </Control>

        <Control label="Owner" htmlFor="pipeline-owner">
          <select
            id="pipeline-owner"
            value={nextOwner}
            onChange={(event) => {
              setNextOwner(event.target.value);
              setSaved(false);
            }}
            className={INPUT}
          >
            <option value="">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </Control>

        <Control label="Next action date" htmlFor="pipeline-date">
          <input
            id="pipeline-date"
            type="date"
            value={nextDate}
            onChange={(event) => {
              setNextDate(event.target.value);
              setSaved(false);
            }}
            className={INPUT}
          />
        </Control>
      </div>

      <div className="flex flex-col gap-[3px]">
        <label htmlFor="pipeline-reason" className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
          Reason for status change {statusMoved ? '— required, written to the audit log' : ''}
        </label>
        <input
          id="pipeline-reason"
          value={reason}
          aria-describedby="pipeline-reason-help"
          aria-invalid={reasonMissing || undefined}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          className={`${INPUT} w-full ${reasonMissing ? 'border-danger' : ''}`}
        />
        <p id="pipeline-reason-help" className={`text-[11px] ${error ? 'text-danger' : 'text-admin-muted'}`}>
          {error ?? 'Shown on the timeline and in the audit log.'}
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={save}
          disabled={busy || !changed}
          className="h-[30px] rounded-[4px] bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save change'}
        </button>
        {saved ? (
          <span className="flex items-center gap-1.5 text-[12px] text-admin-body">
            <span aria-hidden className="size-[7px] rounded-full bg-result" />
            Saved and audited
          </span>
        ) : null}
      </div>
    </div>
  );
}

const INPUT =
  'h-[30px] rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus';

function Control({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[150px] flex-1 flex-col gap-[3px]">
      <label htmlFor={htmlFor} className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}
