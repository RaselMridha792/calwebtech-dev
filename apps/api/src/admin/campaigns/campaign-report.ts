import type { Prisma } from '@calwebtech/db';
import type { CampaignReportRecipient, RecipientState } from '@calwebtech/shared';

/**
 * How one recipient's row reads in the report (Task 5.4). A state is the furthest thing that
 * happened, with a bounce or complaint above everything because it is what needs acting on.
 * The filter for each state is written against the same rule, so a filtered list and the
 * row's own label cannot disagree.
 */

const NONE = null;

export function stateWhere(state: RecipientState): Prisma.CampaignRecipientWhereInput {
  switch (state) {
    case 'complained':
      return { complainedAt: { not: NONE } };
    case 'bounced':
      return { bouncedAt: { not: NONE }, complainedAt: NONE };
    case 'clicked':
      return { clickedAt: { not: NONE }, bouncedAt: NONE, complainedAt: NONE };
    case 'opened':
      return { openedAt: { not: NONE }, clickedAt: NONE, bouncedAt: NONE, complainedAt: NONE };
    case 'delivered':
      return { deliveredAt: { not: NONE }, openedAt: NONE, clickedAt: NONE, bouncedAt: NONE, complainedAt: NONE };
    case 'sent':
      return {
        sentAt: { not: NONE },
        deliveredAt: NONE,
        openedAt: NONE,
        clickedAt: NONE,
        bouncedAt: NONE,
        complainedAt: NONE,
      };
    case 'not_sent':
      return { failedAt: { not: NONE } };
    case 'pending':
      return { sentAt: NONE, failedAt: NONE };
  }
}

export interface RecipientRow {
  id: string;
  email: string;
  error: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
  failedAt: Date | null;
  subscriber: { name: string | null } | null;
}

export function stateOf(row: RecipientRow): RecipientState {
  if (row.complainedAt) return 'complained';
  if (row.bouncedAt) return 'bounced';
  if (row.clickedAt) return 'clicked';
  if (row.openedAt) return 'opened';
  if (row.deliveredAt) return 'delivered';
  if (row.sentAt) return 'sent';
  if (row.failedAt) return 'not_sent';
  return 'pending';
}

export function toReportRecipient(row: RecipientRow): CampaignReportRecipient {
  const times = [row.sentAt, row.deliveredAt, row.openedAt, row.clickedAt, row.bouncedAt, row.complainedAt, row.failedAt]
    .filter((value): value is Date => value !== null)
    .map((value) => value.getTime());
  return {
    id: row.id,
    email: row.email,
    name: row.subscriber?.name ?? null,
    state: stateOf(row),
    error: row.error,
    sentAt: row.sentAt?.toISOString() ?? null,
    lastEventAt: times.length > 0 ? new Date(Math.max(...times)).toISOString() : null,
  };
}
