import { describe, expect, it } from 'vitest';
import { maskEmail } from './campaigns';
import { signUnsubscribeToken, unsubscribeOneClickPath, unsubscribePagePath, verifyUnsubscribeToken } from './unsubscribe-token';

const SECRET = 'a-long-enough-test-secret-value';

describe('unsubscribe tokens', () => {
  it('verify for the subscriber they were signed for', () => {
    const token = signUnsubscribeToken('cmsubscriber01', SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe('cmsubscriber01');
  });

  it('refuse a token for another subscriber made by swapping the id', () => {
    const token = signUnsubscribeToken('cmsubscriber01', SECRET);
    const forged = `cmsubscriber02${token.slice(token.indexOf('~'))}`;
    expect(verifyUnsubscribeToken(forged, SECRET)).toBeNull();
  });

  it('refuse a token signed with another secret, and anything malformed', () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken('cmsubscriber01', 'another-secret-entirely'), SECRET)).toBeNull();
    expect(verifyUnsubscribeToken('no-separator-at-all', SECRET)).toBeNull();
    expect(verifyUnsubscribeToken('~onlysignature', SECRET)).toBeNull();
    expect(verifyUnsubscribeToken('cmsubscriber01~short', SECRET)).toBeNull();
  });

  it('are safe in a path', () => {
    const token = signUnsubscribeToken('cmsubscriber01', SECRET);
    // Unreserved characters only, and no dot, so the page's trailing slash is not stripped.
    expect(token).toMatch(/^[A-Za-z0-9_~-]+$/);
    expect(unsubscribePagePath(token)).toBe(`/unsubscribe/${token}/`);
    expect(unsubscribeOneClickPath(token)).toBe(`/api/unsubscribe/${token}`);
  });
});

describe('maskEmail', () => {
  it('keeps the domain and the first letter', () => {
    expect(maskEmail('ava@example.com')).toBe('a**@example.com');
    expect(maskEmail('benjamin.hale@example.org')).toBe('b******@example.org');
  });
});
