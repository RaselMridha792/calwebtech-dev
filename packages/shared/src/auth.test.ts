import { describe, expect, it } from 'vitest';
import {
  ADMIN_MODULES,
  ADMIN_ROLES,
  accessTo,
  adminUserSchema,
  canRead,
  canWrite,
  loginSchema,
  modulesFor,
} from './auth';

describe('the permission matrix', () => {
  it('gives the owner every module, with writes', () => {
    expect(modulesFor('OWNER')).toEqual([...ADMIN_MODULES]);
    for (const module of ADMIN_MODULES) expect(canWrite('OWNER', module)).toBe(true);
  });

  it('closes a module a role is not listed for, rather than defaulting it open', () => {
    // The build plan's gate: each role reaches exactly its modules and nothing more.
    expect(accessTo('EDITOR', 'leads')).toBeNull();
    expect(accessTo('SALES', 'content')).toBeNull();
    expect(accessTo('VIEWER', 'team')).toBeNull();
    expect(accessTo('VIEWER', 'settings')).toBeNull();
    expect(accessTo('VIEWER', 'auditLog')).toBeNull();
  });

  it('lets a viewer read what it reaches but write nothing at all', () => {
    const readable = modulesFor('VIEWER');
    expect(readable.length).toBeGreaterThan(0);
    for (const module of ADMIN_MODULES) expect(canWrite('VIEWER', module)).toBe(false);
  });

  it('keeps export away from a viewer, because it would undo the listing redaction', () => {
    expect(canRead('VIEWER', 'export')).toBe(false);
    for (const role of ['OWNER', 'EDITOR', 'SALES'] as const) expect(canWrite(role, 'export')).toBe(true);
  });

  it('separates the two working roles: sales owns the pipeline, editor owns the content', () => {
    expect(canWrite('SALES', 'leads')).toBe(true);
    expect(canWrite('SALES', 'subscribers')).toBe(true);
    expect(canRead('SALES', 'media')).toBe(false);

    expect(canWrite('EDITOR', 'content')).toBe(true);
    expect(canWrite('EDITOR', 'media')).toBe(true);
    expect(canRead('EDITOR', 'bookings')).toBe(false);
  });

  it('reserves the three administrative modules for the owner', () => {
    for (const module of ['team', 'settings', 'auditLog'] as const) {
      for (const role of ADMIN_ROLES) {
        expect(canRead(role, module)).toBe(role === 'OWNER');
      }
    }
  });
});

describe('loginSchema', () => {
  it('normalises the address so case and stray spacing cannot fork an account', () => {
    const parsed = loginSchema.parse({ email: '  Owner@Calwebtech.COM ', password: 'a password' });
    expect(parsed.email).toBe('owner@calwebtech.com');
  });

  it('rejects an address that is not one, and an empty password', () => {
    expect(loginSchema.safeParse({ email: 'not-an-address', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'owner@calwebtech.com', password: '' }).success).toBe(false);
  });

  it('does not impose the password rule on sign-in, so an older password still signs in', () => {
    expect(loginSchema.safeParse({ email: 'owner@calwebtech.com', password: 'short' }).success).toBe(true);
  });
});

describe('adminUserSchema', () => {
  it('has no field that could carry the hash', () => {
    expect(Object.keys(adminUserSchema.shape)).not.toContain('passwordHash');
  });
});
