import type { SegmentCondition, SegmentRules } from '@calwebtech/shared';

/**
 * A rule set in words, for the segment list and the editor's summary line. Lives beside
 * the editor rather than in the shared package because only the dashboard reads it.
 */
export function describeCondition(condition: SegmentCondition): string {
  switch (condition.field) {
    case 'tag':
      return condition.op === 'has' ? `tagged ${condition.value}` : `not tagged ${condition.value}`;
    case 'sourcePage':
      return condition.op === 'is' ? `signed up on ${condition.value}` : `signed up on a page containing ${condition.value}`;
    case 'emailDomain':
      return condition.op === 'is' ? `address at ${condition.value}` : `address not at ${condition.value}`;
    case 'subscribed':
      return condition.op === 'withinDays'
        ? `joined in the last ${String(condition.days)} days`
        : `joined more than ${String(condition.days)} days ago`;
    case 'engaged':
      return condition.op === 'withinDays'
        ? `engaged in the last ${String(condition.days)} days`
        : `not engaged in the last ${String(condition.days)} days`;
  }
}

export function describeRules(rules: SegmentRules): string {
  if (rules.conditions.length === 0) return 'Everyone who may be mailed';
  return rules.conditions.map(describeCondition).join(rules.match === 'all' ? ' and ' : ' or ');
}
