import { describe, expect, it } from 'vitest';
import { describeRules } from './describe-rules';

describe('describeRules', () => {
  it('says who an empty rule set reaches', () => {
    expect(describeRules({ match: 'all', conditions: [] })).toBe('Everyone who may be mailed');
  });

  it('joins the conditions the way they combine', () => {
    const conditions = [
      { field: 'tag', op: 'has', value: 'newsletter' },
      { field: 'engaged', op: 'notWithinDays', days: 90 },
    ] as const;
    expect(describeRules({ match: 'all', conditions: [...conditions] })).toBe(
      'tagged newsletter and not engaged in the last 90 days',
    );
    expect(describeRules({ match: 'any', conditions: [...conditions] })).toBe(
      'tagged newsletter or not engaged in the last 90 days',
    );
  });
});
