import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id password hashing, as CLAUDE.md requires.
 *
 * `Algorithm` in @node-rs/argon2 is a `const enum`, which `isolatedModules` forbids
 * importing, so the value it would have given is named here instead.
 */
const ARGON2ID = 2;

/**
 * OWASP's Argon2id recommendation: 19 MiB of memory, two passes, one lane. These are also
 * the library's defaults, but a password hash should never silently follow a dependency's
 * idea of "enough", so they are stated. The cost is about 20 ms per hash on the production
 * box, which bounds how fast a stolen database can be attacked without making sign-in slow.
 *
 * Raising these later is safe: the parameters are recorded inside every hash string, so old
 * hashes keep verifying and only new ones use the new cost.
 */
export const PASSWORD_HASH_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * A hash of a random string nobody holds. Sign-in verifies against this when the address is
 * unknown, so an unknown address costs the same time as a known one and the endpoint cannot
 * be used to find out who has an account.
 */
export const UNKNOWN_ACCOUNT_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$7binudB6Awyo+G9M5fgq7A$g4aSysPGu7KRIfES+3r/Ufzai9RxpbaRbLfY7x4v4NQ';

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, PASSWORD_HASH_OPTIONS);
}

/**
 * False rather than a throw for a hash this library cannot read, so one corrupted row
 * refuses that one sign-in instead of returning a 500 that says the row is special.
 */
export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}
