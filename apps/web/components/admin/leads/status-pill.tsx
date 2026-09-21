import { LEAD_STATUS_LABELS, type LeadStatus } from '@calwebtech/shared';

/**
 * The status, as a pill with a dot.
 *
 * The dot is the only place teal appears in the inbox, and it is a round affirmative mark,
 * which is exactly what the `result` token is reserved for — the calwebtech/teal-usage rule
 * allows `bg-result` only alongside `rounded-full`. A filled dot means the lead is going
 * well; a ring means it is waiting or over.
 */
const DOT: Record<LeadStatus, string> = {
  NEW: 'rounded-full bg-admin-dot',
  CONTACTED: 'rounded-full bg-admin-surface ring-2 ring-admin-dot ring-inset',
  QUALIFIED: 'rounded-full bg-result',
  PROPOSAL_SENT: 'rounded-full bg-admin-navink',
  WON: 'rounded-full bg-result',
  LOST: 'rounded-full bg-admin-surface ring-2 ring-admin-muted ring-inset',
};

export function StatusPill({ status }: { status: LeadStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-admin-mist py-0.5 pr-2 pl-[7px] text-[11px] font-semibold text-admin-ink">
      <span aria-hidden className={`size-2 shrink-0 ${DOT[status]}`} />
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}
