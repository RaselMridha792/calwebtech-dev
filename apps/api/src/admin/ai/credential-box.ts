import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { usableSigningSecret } from '@calwebtech/shared/unsubscribe-token';

/**
 * Encrypts an AI provider's key for the database, and opens it again for the one request
 * that needs it (docs/08-decisions.md, 64).
 *
 * AES-256-GCM, a fresh 12-byte nonce per key, and the provider's id as associated data, so
 * a sealed key moved onto another provider's row fails to open rather than being sent
 * somewhere it was never meant for. The database alone is not enough to read a key: the
 * secret that encrypts it lives only in the server's environment.
 *
 * That secret is `CREDENTIALS_KEY` (32 random bytes, base64) when the server has one. A
 * server without it derives a key from `AUTH_SECRET` with HKDF instead, so the screen works
 * on a stack that was deployed before this existed. Each sealed key records which secret
 * sealed it, so adding `CREDENTIALS_KEY` later still opens the keys stored before, and the
 * next save moves them across.
 */

export type KeySource = 'credentials-key' | 'auth-secret';

const VERSION = 'v1';
const HKDF_SALT = 'calwebtech';
const HKDF_INFO = 'ai-credentials v1';

export interface CredentialSecrets {
  CREDENTIALS_KEY?: string | undefined;
  AUTH_SECRET?: string | undefined;
}

export class CredentialBox {
  private readonly keys = new Map<KeySource, Buffer>();

  constructor(secrets: CredentialSecrets) {
    const direct = decodeCredentialsKey(secrets.CREDENTIALS_KEY);
    if (direct) this.keys.set('credentials-key', direct);
    if (usableSigningSecret(secrets.AUTH_SECRET) && secrets.AUTH_SECRET) {
      this.keys.set('auth-secret', Buffer.from(hkdfSync('sha256', secrets.AUTH_SECRET, HKDF_SALT, HKDF_INFO, 32)));
    }
  }

  /** The secret a new key is sealed with: the dedicated one when the server has it. */
  source(): KeySource | null {
    if (this.keys.has('credentials-key')) return 'credentials-key';
    if (this.keys.has('auth-secret')) return 'auth-secret';
    return null;
  }

  seal(plain: string, provider: string): { cipher: string; source: KeySource } {
    const source = this.source();
    const key = source ? this.keys.get(source) : undefined;
    if (!source || !key) throw new Error('No secret to encrypt with: set CREDENTIALS_KEY or AUTH_SECRET');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(aad(provider)));
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { cipher: [VERSION, iv.toString('base64url'), tag.toString('base64url'), body.toString('base64url')].join('.'), source };
  }

  /** The key, or null when it cannot be opened: its secret is gone, or it was tampered with. */
  open(sealed: string, source: string, provider: string): string | null {
    const key = this.keys.get(source as KeySource);
    const [version, iv, tag, body] = sealed.split('.');
    if (!key || version !== VERSION || !iv || !tag || !body) return null;
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
      decipher.setAAD(Buffer.from(aad(provider)));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }
}

function aad(provider: string): string {
  return `calwebtech:ai-connection:${provider}`;
}

/** `CREDENTIALS_KEY` is 32 bytes in base64 (`openssl rand -base64 32`); anything else is ignored. */
export function decodeCredentialsKey(value: string | undefined): Buffer | null {
  if (!value) return null;
  const bytes = Buffer.from(value.trim(), 'base64');
  return bytes.length === 32 ? bytes : null;
}

/** The last four characters, which is all the dashboard ever shows of a key. */
export function keyHint(key: string): string {
  return key.slice(-4);
}
