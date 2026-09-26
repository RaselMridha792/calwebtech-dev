import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { adminAiViewSchema } from '@calwebtech/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../../auth/audit.service';
import { loadEnv } from '../../config/env';
import { migrateDeploy } from '../../prisma/migrate-deploy';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAiService } from './admin-ai.service';

/**
 * AI connections against a real database (docs/08-decisions.md, 64): a key is stored
 * encrypted and never comes back out, the audit log never holds it, one connection is the
 * default, and a test call reports what the provider said.
 *
 * The provider is a stubbed `fetch`: nothing leaves the machine. The database is created on
 * the same server as DATABASE_URL and dropped afterwards.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite', CREDENTIALS_KEY: randomBytes(32).toString('base64') });
const run = Date.now().toString(36);
const databaseName = `calwebtech_ai_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const ai = new AdminAiService(prisma, new AuditService(prisma), env);
const actor = { id: '', ip: '203.0.113.9' };

const SECRET_KEY = 'sk-ant-api03-very-secret-value-1234';

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  const user = await db.user.create({
    data: { email: 'owner@calwebtech.test', name: 'The Owner', role: 'OWNER', passwordHash: 'x' },
    select: { id: true },
  });
  actor.id = user.id;
}, 120_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AI connections', () => {
  it('stores the key encrypted and never hands it back', async () => {
    const created = await ai.create(
      { provider: 'anthropic', label: 'Claude', model: 'claude-sonnet-5', apiKey: SECRET_KEY, makeDefault: false },
      actor,
    );
    // The first connection is the default whatever was asked.
    expect(created).toMatchObject({ provider: 'anthropic', keyHint: '1234', keyReadable: true, isDefault: true, baseUrl: null });

    const row = await db.aiConnection.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.keyCipher).not.toContain('very-secret');
    expect(row.keySource).toBe('credentials-key');

    const view = adminAiViewSchema.parse(await ai.view());
    expect(JSON.stringify(view)).not.toContain('very-secret');
    expect(view.storage).toEqual({ available: true, source: 'credentials-key' });

    const audit = await db.auditLog.findMany({ where: { entityType: 'AiConnection' } });
    expect(audit.map((entry) => entry.action)).toContain('ai_connection.created');
    expect(JSON.stringify(audit)).not.toContain('very-secret');
  });

  it('keeps a known provider on its own address, whatever the request says', async () => {
    const created = await ai.create(
      { provider: 'openai', label: 'GPT', model: 'gpt-5', baseUrl: 'https://evil.example.com/v1', apiKey: 'sk-openai-abcdef', makeDefault: false },
      actor,
    );
    expect(created.baseUrl).toBeNull();
    expect(created.isDefault).toBe(false);
  });

  it('refuses a custom address on the private network', async () => {
    await expect(
      ai.create({ provider: 'custom', label: 'Local', model: 'llama', baseUrl: 'https://10.0.0.4/v1', apiKey: 'sk-local-abcdef', makeDefault: false }, actor),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('moves the default, and hands it on when the default is removed', async () => {
    const { connections } = await ai.view();
    const gpt = connections.find((connection) => connection.provider === 'openai');
    const claude = connections.find((connection) => connection.provider === 'anthropic');
    if (!gpt || !claude) throw new Error('fixtures missing');

    const moved = await ai.makeDefault(gpt.id, actor);
    expect(moved.connections.filter((connection) => connection.isDefault).map((connection) => connection.id)).toEqual([gpt.id]);

    const after = await ai.remove(gpt.id, actor);
    expect(after.connections.map((connection) => connection.id)).toEqual([claude.id]);
    expect(after.connections[0]?.isDefault).toBe(true);
    expect(await db.aiConnection.count({ where: { id: gpt.id } })).toBe(0);
  });

  it('replaces a key and forgets the old test result', async () => {
    const [claude] = (await ai.view()).connections;
    if (!claude) throw new Error('fixture missing');
    await db.aiConnection.update({ where: { id: claude.id }, data: { lastTestAt: new Date(), lastTestOk: true } });
    const updated = await ai.update(claude.id, { apiKey: 'sk-ant-new-key-9876', model: 'claude-haiku-4-5-20251001' }, actor);
    expect(updated).toMatchObject({ keyHint: '9876', model: 'claude-haiku-4-5-20251001', lastTest: null });
  });

  it('reports what the provider answered, and records the test', async () => {
    const sent: { headers: Record<string, string> }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        sent.push({ headers: init.headers as Record<string, string> });
        return Promise.resolve(
          Response.json({ model: 'claude-haiku-4-5-20251001', content: [{ type: 'text', text: 'Hello from Claude.' }], usage: { input_tokens: 8, output_tokens: 5 } }),
        );
      }),
    );
    const [claude] = (await ai.view()).connections;
    if (!claude) throw new Error('fixture missing');

    const result = await ai.test(claude.id, { prompt: 'Say hello.', maxTokens: 64 }, actor);
    expect(result).toMatchObject({ ok: true, text: 'Hello from Claude.', usage: { input: 8, output: 5 }, error: null });
    // The decrypted key reached the provider, and only the provider.
    expect(sent[0]?.headers['x-api-key']).toBe('sk-ant-new-key-9876');
    expect((await ai.view()).connections[0]?.lastTest).toMatchObject({ ok: true });

    const reply = await ai.complete({ prompt: 'Again.', maxTokens: 32 });
    expect(reply.text).toBe('Hello from Claude.');
  });

  it('reports a refused key as a failed test, not an error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json({ error: { message: 'invalid x-api-key' } }, { status: 401 }))));
    const [claude] = (await ai.view()).connections;
    if (!claude) throw new Error('fixture missing');
    const result = await ai.test(claude.id, { prompt: 'Say hello.', maxTokens: 64 }, actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/refused the key/);
    expect((await ai.view()).connections[0]?.lastTest).toMatchObject({ ok: false });
  });

  it('says a key is unreadable once the server’s secret has changed', async () => {
    const other = new AdminAiService(prisma, new AuditService(prisma), { ...env, CREDENTIALS_KEY: randomBytes(32).toString('base64') });
    const view = await other.view();
    expect(view.connections[0]?.keyReadable).toBe(false);
  });
});
