'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { ERROR, HELP, INPUT, LABEL, SELECT, button } from '../ui/styles';

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
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Control label="Status" htmlFor="pipeline-status">
          <select
            id="pipeline-status"
            value={nextStatus}
            onChange={(event) => {
              setNextStatus(event.target.value);
              setSaved(false);
            }}
            className={SELECT}
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
            className={SELECT}
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pipeline-reason" className={LABEL}>
          Reason for the status change{statusMoved ? ' (required)' : ''}
        </label>
        <input
          id="pipeline-reason"
          value={reason}
          aria-describedby="pipeline-reason-help"
          aria-invalid={reasonMissing || undefined}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          className={INPUT}
        />
        <p id="pipeline-reason-help" className={error ? ERROR : HELP}>
          {error ?? 'Shown on the timeline and in the audit log.'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy || !changed} className={button('primary')}>
          {busy ? 'Saving…' : 'Save change'}
        </button>
        {saved ? (
          <span role="status" className="flex items-center gap-2 text-[13px] text-ink-invert-muted motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]">
            <span aria-hidden className="size-2 rounded-full bg-result" />
            Saved and audited
          </span>
        ) : null}
      </div>
    </div>
  );
}


function Control({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 last:sm:col-span-2">
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
    </div>
  );
}
