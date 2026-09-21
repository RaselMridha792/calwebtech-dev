import { describe, expect, it } from 'vitest';
import { PASSWORD_HASH_OPTIONS, UNKNOWN_ACCOUNT_HASH, hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('produces an Argon2id hash carrying the parameters it was made with', async () => {
    const hash = await hashPassword('a long enough password');
    // The parameters live in the string, which is what lets them be raised later without
    // invalidating the hashes already stored.
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toContain(`m=${String(PASSWORD_HASH_OPTIONS.memoryCost)}`);
    expect(hash).toContain(`t=${String(PASSWORD_HASH_OPTIONS.timeCost)}`);
  });

  it('salts, so the same password twice is not the same hash', async () => {
    const [first, second] = await Promise.all([hashPassword('the same password'), hashPassword('the same password')]);
    expect(first).not.toBe(second);
    expect(await verifyPassword(first, 'the same password')).toBe(true);
    expect(await verifyPassword(second, 'the same password')).toBe(true);
  });

  it('accepts the right password and refuses a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(hash, 'Correct horse battery staple')).toBe(false);
    expect(await verifyPassword(hash, '')).toBe(false);
  });

  it('answers false for a hash it cannot read, rather than throwing', async () => {
    // One corrupted row should refuse that one sign-in, not turn into a 500 that tells an
    // attacker the row is special.
    expect(await verifyPassword('not a hash at all', 'anything')).toBe(false);
    expect(await verifyPassword('', 'anything')).toBe(false);
  });

  it('keeps a usable constant hash for an unknown address', async () => {
    // Verifying against it must cost the work of a real check, and must never succeed.
    expect(UNKNOWN_ACCOUNT_HASH.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(UNKNOWN_ACCOUNT_HASH, 'password')).toBe(false);
    expect(await verifyPassword(UNKNOWN_ACCOUNT_HASH, '')).toBe(false);
  });
});
