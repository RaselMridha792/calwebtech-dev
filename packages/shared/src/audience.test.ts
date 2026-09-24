import { describe, expect, it } from 'vitest';
import {
  segmentRulesSchema,
  segmentWriteSchema,
  subscriberTagsUpdateSchema,
  suppressionCreateSchema,
  tagNameSchema,
} from './audience';

describe('tags', () => {
  it('are lower case and trimmed, so one tag is never two', () => {
    expect(tagNameSchema.parse('  Newsletter ')).toBe('newsletter');
  });

  it('refuse punctuation that would read as a rule', () => {
    expect(tagNameSchema.safeParse('vip;drop').success).toBe(false);
  });

  it('are saved once each', () => {
    expect(subscriberTagsUpdateSchema.parse({ tags: ['VIP', 'vip', 'lead'] }).tags).toEqual(['vip', 'lead']);
  });
});

describe('segment rules', () => {
  it('default to every eligible subscriber', () => {
    expect(segmentRulesSchema.parse({})).toEqual({ match: 'all', conditions: [] });
  });

  it('strip the @ from a domain', () => {
    const rules = segmentRulesSchema.parse({
      conditions: [{ field: 'emailDomain', op: 'is', value: '@Example.com' }],
    });
    expect(rules.conditions[0]).toEqual({ field: 'emailDomain', op: 'is', value: 'example.com' });
  });

  it('refuse an operator the field does not have', () => {
    expect(segmentRulesSchema.safeParse({ conditions: [{ field: 'tag', op: 'withinDays', value: 'x' }] }).success).toBe(
      false,
    );
  });

  it('refuse a day count of zero', () => {
    expect(segmentRulesSchema.safeParse({ conditions: [{ field: 'engaged', op: 'withinDays', days: 0 }] }).success).toBe(
      false,
    );
  });

  it('need a name to be saved', () => {
    expect(segmentWriteSchema.safeParse({ name: '  ', rules: {} }).success).toBe(false);
  });
});

describe('suppression', () => {
  it('stores the address in lower case', () => {
    expect(suppressionCreateSchema.parse({ email: ' Someone@Example.COM ' }).email).toBe('someone@example.com');
  });
});
