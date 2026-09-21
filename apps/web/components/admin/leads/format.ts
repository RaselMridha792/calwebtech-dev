import {
  BUDGET_BANDS,
  LEAD_CHANNELS,
  LEAD_STATUS_LABELS,
  LEAD_TYPE_LABELS,
  START_TIMELINES,
  type LeadChannel,
  type LeadStatus,
  type LeadType,
} from '@calwebtech/shared';

/**
 * Labels and dates for the inbox. Server-only by convention: everything here imports the
 * shared barrel, which must not reach a client bundle (commit 59d10b2). A client component
 * that needs one of these takes it as a prop.
 */

export function statusLabel(status: LeadStatus): string {
  return LEAD_STATUS_LABELS[status];
}

export function typeLabel(type: LeadType): string {
  return LEAD_TYPE_LABELS[type];
}

export function channelLabel(channel: LeadChannel): string {
  return LEAD_CHANNELS.find((entry) => entry.value === channel)?.label ?? 'Direct';
}

/** The band the visitor chose, in their words. An em dash where they chose none. */
export function budgetLabel(band: string | null): string {
  if (!band) return '—';
  return BUDGET_BANDS.find((entry) => entry.value === band)?.label ?? band;
}

/**
 * The same band, short enough for a 9% column. The figures are the ones the forms actually
 * offer (packages/shared, BUDGET_BANDS), which are in dollars.
 */
const BUDGET_SHORT: Record<string, string> = {
  'under-12k': '< $12k',
  '12k-25k': '$12–25k',
  '25k-60k': '$25–60k',
  '60k-120k': '$60–120k',
  'over-120k': '$120k+',
  'not-sure': 'Not sure',
};

export function budgetShort(band: string | null): string {
  if (!band) return '—';
  return BUDGET_SHORT[band] ?? band;
}

export function timelineLabel(timeline: string | null): string {
  if (!timeline) return '—';
  return START_TIMELINES.find((entry) => entry.value === timeline)?.label ?? timeline;
}

/**
 * Short and absolute rather than "3 days ago": the inbox is a working record, and a
 * relative time in a table cell cannot be compared with the one below it.
 */
export function received(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getUTCFullYear() === new Date().getUTCFullYear();
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

/** With the time, for the places that have room for it. */
export function receivedLong(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function dateOnly(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** The value a date input wants, from the ISO instant the API returns. */
export function dateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}
