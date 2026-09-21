import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { TEAM_ERRORS } from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../auth/audit.service';
import { SessionsService } from '../../auth/sessions.service';
import { loadEnv } from '../../config/env';
import { migrateDeploy } from '../../prisma/migrate-deploy';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminTeamService } from './admin-team.service';

/**
 * The three rules that keep an owner from locking everyone out of a live site:
 *
 * - nobody changes their own role
 * - nobody disables themselves
 * - the last active owner cannot be demoted or disabled
 *
 * Each is a question about the whole table — "is there another active owner?" — so none of
 * them can be proved without a database, which is why this is an integration test and not a
 * unit test. Without the third rule one click leaves production with nobody able to reach
 * settings, team or the audit log, and the only way back is `admin-cli` over SSH.
 *
 * The database is created on the same server as DATABASE_URL and dropped afterwards, so the
 * seed and fixtures the other suites rely on are never touched.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite' });
const run = Date.now().toString(36);
const databaseName = `calwebtech_team_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const sessions = new SessionsService(prisma);
const team = new AdminTeamService(prisma, sessions, new AuditService(prisma));

/** Both ids are set in beforeAll; the owner is the one acting in every case below. */
let ownerId = '';
let editorId = '';
const actor = (): { id: string; ip: string | null } => ({ id: ownerId, ip: '203.0.113.7' });

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);

  const owner = await db.user.create({
    data: { email: 'owner@calwebtech.test', name: 'The Owner', role: 'OWNER', passwordHash: 'x' },
    select: { id: true },
  });
  ownerId = owner.id;
  const editor = await db.user.create({
    data: { email: 'editor@calwebtech.test', name: 'An Editor', role: 'EDITOR', passwordHash: 'x' },
    select: { id: true },
  });
  editorId = editor.id;
}, 180_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('the last owner', () => {
  it('cannot be demoted while they are the only active one', async () => {
    await expect(team.changeRole(ownerId, 'EDITOR', { id: editorId, ip: null })).rejects.toMatchObject({
      response: { error: TEAM_ERRORS.lastOwner },
    });
    const still = await db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { role: true } });
    expect(still.role).toBe('OWNER');
  });

  it('cannot be disabled while they are the only active one', async () => {
    await expect(team.disable(ownerId, { id: editorId, ip: null })).rejects.toMatchObject({
      response: { error: TEAM_ERRORS.lastOwner },
    });
    const still = await db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { deletedAt: true } });
    expect(still.deletedAt).toBeNull();
  });

  it('can be demoted once someone else is an owner, and not after they are disabled again', async () => {
    await team.changeRole(editorId, 'OWNER', actor());
    // Two active owners, so the first may now step down.
    await team.changeRole(ownerId, 'EDITOR', { id: editorId, ip: null });
    expect((await db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { role: true } })).role).toBe('EDITOR');

    // And the rule now protects the remaining one instead.
    await expect(team.changeRole(editorId, 'VIEWER', { id: ownerId, ip: null })).rejects.toMatchObject({
      response: { error: TEAM_ERRORS.lastOwner },
    });

    await team.changeRole(ownerId, 'OWNER', { id: editorId, ip: null });
  });

  it('counts only active owners, so a disabled one does not hold the door open', async () => {
    // editorId is an owner from the case above; disable it and ownerId is alone again.
    await team.disable(editorId, actor());
    await expect(team.changeRole(ownerId, 'EDITOR', { id: editorId, ip: null })).rejects.toMatchObject({
      response: { error: TEAM_ERRORS.lastOwner },
    });
    await team.enable(editorId, actor());
    await team.changeRole(editorId, 'EDITOR', actor());
  });
});

describe('acting on yourself', () => {
  it('refuses a role change and a disable, whoever you are', async () => {
    await expect(team.changeRole(ownerId, 'VIEWER', actor())).rejects.toMatchObject({
      response: { error: TEAM_ERRORS.self },
    });
    await expect(team.disable(ownerId, actor())).rejects.toMatchObject({ response: { error: TEAM_ERRORS.self } });
  });
});

describe('disabling someone', () => {
  it('soft-deletes them, takes every session, and keeps them listed', async () => {
    await sessions.create(editorId, '198.51.100.9', 'a browser');
    await sessions.create(editorId, '198.51.100.9', 'another browser');
    expect(await db.session.count({ where: { userId: editorId } })).toBe(2);

    await team.disable(editorId, actor());

    const row = await db.user.findUniqueOrThrow({ where: { id: editorId }, select: { deletedAt: true } });
    expect(row.deletedAt).not.toBeNull();
    // Gone immediately: otherwise the account keeps working until its cookie idles out.
    expect(await db.session.count({ where: { userId: editorId } })).toBe(0);

    // Still listed, because the audit log points at this id and an entry with no author is
    // worth much less than one with a disabled author.
    const view = await team.list(ownerId);
    expect(view.members.map((member) => member.id)).toContain(editorId);
    expect(view.members.find((member) => member.id === editorId)?.disabledAt).not.toBeNull();

    await team.enable(editorId, actor());
  });
});

describe('adding someone', () => {
  it('returns a first password once, stores only its hash, and refuses a duplicate address', async () => {
    const created = await team.create(
      { email: 'new.person@calwebtech.test', name: 'New Person', role: 'SALES' },
      actor(),
    );
    expect(created.temporaryPassword.length).toBeGreaterThanOrEqual(12);

    const stored = await db.user.findUniqueOrThrow({
      where: { email: 'new.person@calwebtech.test' },
      select: { passwordHash: true, role: true },
    });
    expect(stored.role).toBe('SALES');
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(stored.passwordHash).not.toContain(created.temporaryPassword);

    await expect(
      team.create({ email: 'new.person@calwebtech.test', name: 'Someone Else', role: 'VIEWER' }, actor()),
    ).rejects.toMatchObject({ response: { error: TEAM_ERRORS.duplicate } });
  });
});

describe('the audit trail', () => {
  it('records every account change with an actor', async () => {
    const entries = await db.auditLog.findMany({
      where: { entityType: 'User' },
      select: { action: true, userId: true },
    });
    expect(entries.length).toBeGreaterThan(0);
    expect(new Set(entries.map((entry) => entry.action))).toContain('user.created');
    // Nothing here is anonymous: each of these was done by a signed-in account.
    expect(entries.every((entry) => entry.userId !== null)).toBe(true);
  });
});
