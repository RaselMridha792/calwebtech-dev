import { describe, expect, it } from 'vitest';
import { withServiceInterest } from './leads.service';

describe('withServiceInterest', () => {
  it('adds the service page title once, keeping what the visitor chose', () => {
    expect(withServiceInterest([], 'Website redesign')).toEqual(['Website redesign']);
    expect(withServiceInterest(['Care plan'], 'Website redesign')).toEqual(['Care plan', 'Website redesign']);
    expect(withServiceInterest(['website redesign'], 'Website redesign')).toEqual(['website redesign']);
  });

  it('keeps titles within the stored length and ignores a blank title', () => {
    expect(withServiceInterest([], 'x'.repeat(120))[0]).toHaveLength(80);
    expect(withServiceInterest(['Care plan'], '  ')).toEqual(['Care plan']);
  });
});
