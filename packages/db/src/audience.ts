import type { Prisma, PrismaClient } from './generated/prisma/client';
import type { SegmentCondition, SegmentRules } from '@calwebtech/shared';

/**
 * Segment rules as Prisma filters (Task 5.4). Here rather than in the API because the API
 * counts an audience while a segment is built and the worker resolves it again at send
 * time, and the two must never disagree about who a rule set reaches.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

/** One condition as a Prisma filter. Relative dates are resolved against `now`. */
export function conditionWhere(condition: SegmentCondition, now: Date): Prisma.SubscriberWhereInput {
  switch (condition.field) {
    case 'tag':
      return condition.op === 'has'
        ? { tags: { some: { tagName: condition.value } } }
        : { tags: { none: { tagName: condition.value } } };
    case 'sourcePage':
      return condition.op === 'is'
        ? { sourcePage: { equals: condition.value, mode: 'insensitive' } }
        : { sourcePage: { contains: condition.value, mode: 'insensitive' } };
    case 'emailDomain': {
      const domain: Prisma.SubscriberWhereInput = { email: { endsWith: `@${condition.value}`, mode: 'insensitive' } };
      return condition.op === 'is' ? domain : { NOT: domain };
    }
    case 'subscribed': {
      const cutoff = daysBefore(now, condition.days);
      return condition.op === 'withinDays' ? { consentAt: { gte: cutoff } } : { consentAt: { lt: cutoff } };
    }
    case 'engaged': {
      const cutoff = daysBefore(now, condition.days);
      return condition.op === 'withinDays'
        ? { lastEngagedAt: { gte: cutoff } }
        : // Somebody who has never engaged has not engaged in the last N days either.
          { OR: [{ lastEngagedAt: null }, { lastEngagedAt: { lt: cutoff } }] };
    }
  }
}

/** A segment's rule set as a Prisma filter. No conditions matches everyone. */
export function segmentWhere(rules: SegmentRules, now: Date): Prisma.SubscriberWhereInput {
  if (rules.conditions.length === 0) return {};
  const parts = rules.conditions.map((condition) => conditionWhere(condition, now));
  return rules.match === 'all' ? { AND: parts } : { OR: parts };
}

/**
 * Who may be mailed at all: not unsubscribed, and not on the suppression list.
 *
 * This is applied on top of every segment rather than left to the segment to say, so no
 * rule set, however it is written, can reach an address that asked not to be written to.
 */
export function eligibleWhere(suppressedEmails: readonly string[]): Prisma.SubscriberWhereInput {
  return {
    unsubscribedAt: null,
    ...(suppressedEmails.length > 0
      ? { email: { notIn: [...suppressedEmails], mode: 'insensitive' } }
      : {}),
  };
}

/** Every suppressed address. Read in full: it is the one list that is never approximated. */
export async function suppressedEmails(db: PrismaClient): Promise<string[]> {
  const rows = await db.suppression.findMany({ select: { email: true } });
  return rows.map((row) => row.email);
}

/** Who a rule set reaches right now, with suppression and unsubscribes taken out. */
export async function audienceWhere(
  db: PrismaClient,
  rules: SegmentRules,
  now = new Date(),
): Promise<Prisma.SubscriberWhereInput> {
  return { AND: [eligibleWhere(await suppressedEmails(db)), segmentWhere(rules, now)] };
}
