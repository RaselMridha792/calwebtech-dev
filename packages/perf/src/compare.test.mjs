import { describe, expect, it } from 'vitest';
import { diverges, TOLERANCES } from './compare.mjs';

const byLabel = (label) => {
  const tolerance = TOLERANCES.find((item) => item.label === label);
  if (!tolerance) throw new Error(`no tolerance for ${label}`);
  return tolerance;
};

describe('diverges', () => {
  it('ignores small absolute differences on small values', () => {
    expect(diverges(40, 80, byLabel('TBT (ms)'))).toBe(false);
  });

  it('flags a relative gap once it also clears the floor', () => {
    expect(diverges(2267, 2700, byLabel('LCP (ms)'))).toBe(true);
    expect(diverges(2267, 2400, byLabel('LCP (ms)'))).toBe(false);
  });

  it('treats category scores on an absolute scale', () => {
    expect(diverges(0.98, 0.9, byLabel('Performance'))).toBe(true);
    expect(diverges(0.98, 0.95, byLabel('Performance'))).toBe(false);
  });
});
