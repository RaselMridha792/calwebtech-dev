import {
  aiProvider,
  type AdminAiView,
  type AiConnection,
  type AiConnectionCreate,
  type AiConnectionUpdate,
  type AiProviderId,
  type AiTestRequest,
  type AiTestResult,
} from '@calwebtech/shared';
import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AuditService } from '../../auth/audit.service';
import { API_ENV, type ApiEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import type { Actor } from '../leads/admin-leads.service';
import { CredentialBox, keyHint } from './credential-box';
import { AiCallError, complete, listModels, type AiCompletion, type AiPrompt, type AiTarget } from './providers';
import { UnsafeAddressError, assertPublicHttps } from './public-url';

interface ConnectionRow {
  id: string;
  provider: string;
  label: string;
  model: string;
  baseUrl: string | null;
  keyCipher: string;
  keySource: string;
  keyHint: string;
  isDefault: boolean;
  lastTestAt: Date | null;
  lastTestOk: boolean | null;
  lastTestMs: number | null;
  lastTestError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AI connections (docs/08-decisions.md, 64): a provider, a model and an encrypted key per
 * connection, one of them the default the site uses.
 *
 * Keys go in and never come out: every view is built from the row with the cipher left
 * behind, and only `target()` opens a key, for the call that needs it. Every change is
 * audited with the key left out, so the log says who connected what without holding it.
 *
 * `complete()` is what a feature calls when it wants the AI to do something; it uses the
 * default connection, and knows nothing of the provider behind it.
 */
@Injectable()
export class AdminAiService {
  private readonly box: CredentialBox;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(API_ENV) env: ApiEnv,
  ) {
    this.box = new CredentialBox(env);
  }

  async view(): Promise<AdminAiView> {
    const rows = await this.prisma.client.aiConnection.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
    const source = this.box.source();
    return {
      connections: rows.map((row) => this.toView(row)),
      storage: { available: source !== null, source },
    };
  }

  async create(input: AiConnectionCreate, actor: Actor): Promise<AiConnection> {
    const baseUrl = await this.checkedBaseUrl(input.provider, input.baseUrl ?? null);
    const sealed = this.seal(input.apiKey, input.provider);
    const existing = await this.prisma.client.aiConnection.count();
    const makeDefault = input.makeDefault || existing === 0;

    const row = await this.prisma.client.$transaction(async (tx) => {
      if (makeDefault) await tx.aiConnection.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      return tx.aiConnection.create({
        data: {
          provider: input.provider,
          label: input.label,
          model: input.model,
          baseUrl,
          keyCipher: sealed.cipher,
          keySource: sealed.source,
          keyHint: keyHint(input.apiKey),
          isDefault: makeDefault,
          createdById: actor.id,
        },
      });
    });

    await this.audit.record({
      userId: actor.id,
      action: 'ai_connection.created',
      entityType: 'AiConnection',
      entityId: row.id,
      after: describe(row),
      ip: actor.ip,
    });
    return this.toView(row);
  }

  async update(id: string, input: AiConnectionUpdate, actor: Actor): Promise<AiConnection> {
    const before = await this.find(id);
    const baseUrl = input.baseUrl === undefined ? undefined : await this.checkedBaseUrl(before.provider, input.baseUrl);
    const sealed = input.apiKey ? this.seal(input.apiKey, before.provider) : null;

    const row = await this.prisma.client.aiConnection.update({
      where: { id },
      data: {
        ...(input.label === undefined ? {} : { label: input.label }),
        ...(input.model === undefined ? {} : { model: input.model }),
        ...(baseUrl === undefined ? {} : { baseUrl }),
        ...(sealed && input.apiKey
          ? {
              keyCipher: sealed.cipher,
              keySource: sealed.source,
              keyHint: keyHint(input.apiKey),
              // A new key has not been tried yet: the old result says nothing about it.
              lastTestAt: null,
              lastTestOk: null,
              lastTestMs: null,
              lastTestError: null,
            }
          : {}),
      },
    });

    await this.audit.record({
      userId: actor.id,
      action: 'ai_connection.updated',
      entityType: 'AiConnection',
      entityId: id,
      before: describe(before),
      after: { ...describe(row), keyReplaced: Boolean(sealed) },
      ip: actor.ip,
    });
    return this.toView(row);
  }

  async makeDefault(id: string, actor: Actor): Promise<AdminAiView> {
    await this.find(id);
    await this.prisma.client.$transaction([
      this.prisma.client.aiConnection.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      this.prisma.client.aiConnection.update({ where: { id }, data: { isDefault: true } }),
    ]);
    await this.audit.record({
      userId: actor.id,
      action: 'ai_connection.default_set',
      entityType: 'AiConnection',
      entityId: id,
      ip: actor.ip,
    });
    return this.view();
  }

  /**
   * Deleted outright, key and all. When the default goes, the oldest remaining connection
   * takes its place, so the site is never left pointing at nothing while others exist.
   */
  async remove(id: string, actor: Actor): Promise<AdminAiView> {
    const before = await this.find(id);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.aiConnection.delete({ where: { id } });
      if (before.isDefault) {
        const next = await tx.aiConnection.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
        if (next) await tx.aiConnection.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    await this.audit.record({
      userId: actor.id,
      action: 'ai_connection.removed',
      entityType: 'AiConnection',
      entityId: id,
      before: describe(before),
      ip: actor.ip,
    });
    return this.view();
  }

  /**
   * Sends a prompt through one connection and reports exactly what came back, or why not.
   * A failure is an answer here, not an exception: the screen shows it.
   */
  async test(id: string, request: AiTestRequest, actor: Actor): Promise<AiTestResult> {
    const row = await this.find(id);
    const started = Date.now();
    let result: AiTestResult;
    try {
      const reply = await complete(await this.target(row), {
        system: request.system,
        prompt: request.prompt,
        maxTokens: request.maxTokens,
      });
      result = {
        ok: true,
        text: reply.text,
        model: reply.model,
        latencyMs: Date.now() - started,
        usage: reply.usage,
        error: reply.text ? null : 'The provider answered, but with no text.',
      };
    } catch (error) {
      result = { ok: false, text: null, model: null, latencyMs: Date.now() - started, usage: null, error: failure(error) };
    }

    await this.prisma.client.aiConnection.update({
      where: { id },
      data: { lastTestAt: new Date(), lastTestOk: result.ok, lastTestMs: result.latencyMs, lastTestError: result.error },
    });
    await this.audit.recordQuietly({
      userId: actor.id,
      action: 'ai_connection.tested',
      entityType: 'AiConnection',
      entityId: id,
      after: { ok: result.ok, model: result.model ?? row.model, latencyMs: result.latencyMs },
      ip: actor.ip,
    });
    return result;
  }

  /** The provider's own list of models for this key. */
  async models(id: string): Promise<string[]> {
    const row = await this.find(id);
    try {
      return await listModels(await this.target(row));
    } catch (error) {
      throw new BadRequestException({ error: 'models_unavailable', message: failure(error) });
    }
  }

  /**
   * For a feature that wants the AI to do something: the default connection, whichever
   * provider it is. Throws when none is set up, so a feature can say so rather than guess.
   */
  async complete(prompt: AiPrompt): Promise<AiCompletion> {
    const row = await this.prisma.client.aiConnection.findFirst({ where: { isDefault: true } });
    if (!row) throw new ServiceUnavailableException({ error: 'ai_not_configured', message: 'No AI connection is set up.' });
    return complete(await this.target(row), prompt);
  }

  // ---------------------------------------------------------------- internals

  private async find(id: string): Promise<ConnectionRow> {
    const row = await this.prisma.client.aiConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    return row;
  }

  /** The one place a key is opened, just before the call that needs it. */
  private async target(row: ConnectionRow): Promise<AiTarget> {
    const apiKey = this.box.open(row.keyCipher, row.keySource, row.provider);
    if (!apiKey) throw new AiCallError('This server cannot read the stored key any more. Enter the key again.');
    // Checked again at call time: a name that was public when saved may not be now.
    if (row.baseUrl) await assertPublicHttps(row.baseUrl);
    return { provider: row.provider, model: row.model, baseUrl: row.baseUrl, apiKey };
  }

  private seal(apiKey: string, provider: string): { cipher: string; source: string } {
    if (!this.box.source()) {
      throw new BadRequestException({
        error: 'storage_unavailable',
        message: 'This server has no secret to encrypt keys with. Set CREDENTIALS_KEY (or AUTH_SECRET) on the server first.',
      });
    }
    return this.box.seal(apiKey, provider);
  }

  /**
   * A known service's address is fixed and never taken from the request; one that asks for
   * its own must give a public https address.
   */
  private async checkedBaseUrl(provider: string, baseUrl: string | null): Promise<string | null> {
    const info = aiProvider(provider);
    if (!info) throw new BadRequestException({ error: 'unknown_provider' });
    if (info.baseUrl !== null) return null;
    if (!baseUrl) throw fieldError('baseUrl', 'This provider needs its address.');
    try {
      return (await assertPublicHttps(baseUrl)).toString().replace(/\/+$/, '');
    } catch (error) {
      throw fieldError('baseUrl', error instanceof UnsafeAddressError ? error.message : 'That address cannot be used.');
    }
  }

  private toView(row: ConnectionRow): AiConnection {
    return {
      id: row.id,
      provider: row.provider as AiProviderId,
      label: row.label,
      model: row.model,
      baseUrl: row.baseUrl,
      keyHint: row.keyHint,
      keyReadable: this.box.open(row.keyCipher, row.keySource, row.provider) !== null,
      isDefault: row.isDefault,
      lastTest: row.lastTestAt
        ? { at: row.lastTestAt.toISOString(), ok: row.lastTestOk ?? false, latencyMs: row.lastTestMs, error: row.lastTestError }
        : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

/** What the audit log keeps of a connection: everything but the key. */
function describe(row: ConnectionRow): Record<string, unknown> {
  return {
    provider: row.provider,
    label: row.label,
    model: row.model,
    baseUrl: row.baseUrl,
    keyHint: `…${row.keyHint}`,
    isDefault: row.isDefault,
  };
}

function failure(error: unknown): string {
  if (error instanceof AiCallError || error instanceof UnsafeAddressError) return error.message;
  return 'Something went wrong calling the provider.';
}

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ error: 'validation_failed', fieldErrors: { [field]: [message] } });
}
