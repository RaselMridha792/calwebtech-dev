import { describe, expect, it } from 'vitest';
import { changedSections, redactSecrets } from './changed-fields';

/** What an audit entry keeps of a change (decisions 59 and 68). */
describe('changed fields', () => {
  it('names the top-level fields whose value changed, whatever order the keys are stored in', () => {
    expect(changedSections({ a: { x: 1, y: 2 }, b: 1 }, { b: 1, a: { y: 2, x: 1 } })).toEqual([]);
    expect(changedSections({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 })).toEqual(['b', 'c']);
    expect(changedSections(null, { index: true })).toEqual(['index']);
  });

  it('keeps a secret-named field but never its value, at any depth', () => {
    const value = {
      email: 'hello@example.com',
      apiKey: 'sk-live-123',
      nested: { password: 'hunter2', signingSecret: 'abc', list: [{ token: 't-1', label: 'kept' }] },
      privateKey: '',
    };
    const redacted = redactSecrets(value);
    expect(redacted).toEqual({
      email: 'hello@example.com',
      apiKey: '[redacted]',
      nested: { password: '[redacted]', signingSecret: '[redacted]', list: [{ token: '[redacted]', label: 'kept' }] },
      privateKey: '',
    });
    expect(JSON.stringify(redacted)).not.toMatch(/sk-live|hunter2|t-1/);
    // The original is untouched.
    expect(value.apiKey).toBe('sk-live-123');
  });
});
