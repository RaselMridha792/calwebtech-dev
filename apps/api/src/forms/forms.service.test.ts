import { formsProjectDraftSchema, type FormsProjectDraftInput } from '@calwebtech/shared';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { openProjectDraft } from './forms.draft';
import { FormsService } from './forms.service';

interface StoredLead {
  id: string;
  answers: unknown;
}

/** A Prisma client that records writes, holding one lead row at most. */
function fakePrisma(existing: StoredLead | null = null) {
  const created: { data: Record<string, unknown> }[] = [];
  const updated: { where: { id: string }; data: Record<string, unknown> }[] = [];
  const lead = {
    findFirst: vi.fn(({ where }: { where: { id: string; email: string } }) =>
      Promise.resolve(existing && existing.id === where.id ? existing : null),
    ),
    create: vi.fn((args: { data: Record<string, unknown> }) => {
      created.push(args);
      return Promise.resolve({ id: 'lead-new' });
    }),
    update: vi.fn((args: { where: { id: string }; data: Record<string, unknown> }) => {
      updated.push(args);
      return Promise.resolve({ id: args.where.id });
    }),
  };
  const client = {
    lead,
    contact: { upsert: vi.fn(() => Promise.resolve({ id: 'contact-1' })) },
    $transaction: (run: (tx: unknown) => Promise<unknown>) => run(client),
  };
  return { prisma: { client } as unknown as PrismaService, lead, client, created, updated };
}

function draftInput(overrides: Partial<FormsProjectDraftInput> = {}) {
  return formsProjectDraftSchema.parse({
    formId: 'start-a-project',
    step: 2,
    name: 'Dana Whitfield',
    email: 'dana@example.com',
    serviceInterest: [],
    ...overrides,
  });
}

describe('FormsService.saveProjectDraft', () => {
  it('stores the brief the first time, with a token the browser holds', async () => {
    const { prisma, created, client } = fakePrisma();
    const result = await new FormsService(prisma).saveProjectDraft(draftInput({ projectType: 'redesign' }));

    expect(result.draft?.id).toBe('lead-new');
    expect(result.draft?.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.draft?.step).toBe(2);
    const data = created[0]?.data ?? {};
    expect(data).toMatchObject({ type: 'PROJECT', email: 'dana@example.com', projectType: 'redesign' });
    expect(openProjectDraft(data.answers, result.draft?.token)).not.toBeNull();
    expect(client.contact.upsert).toHaveBeenCalledTimes(1);
  });

  it('writes to the same lead on the next step instead of creating a second one', async () => {
    const started = await new FormsService(fakePrisma().prisma).saveProjectDraft(draftInput());
    const token = started.draft?.token ?? '';
    const stored = { id: 'lead-1', answers: { draft: { token, step: 2, furthestStep: 2, formId: 'start-a-project' } } };

    const { prisma, updated, lead } = fakePrisma(stored);
    const result = await new FormsService(prisma).saveProjectDraft(
      draftInput({ step: 4, budgetBand: '25k-60k', draftId: 'lead-1', draftToken: token }),
    );

    expect(lead.create).not.toHaveBeenCalled();
    expect(result.draft).toEqual({ id: 'lead-1', token, step: 4 });
    expect(updated[0]?.data).toMatchObject({ budgetBand: '25k-60k' });
    expect(updated[0]?.data.activities).toBeDefined();
  });

  it('records a step only when the step changed, so a saved edit does not look like progress', async () => {
    const token = 'token-1';
    const stored = { id: 'lead-1', answers: { draft: { token, step: 4, furthestStep: 4 } } };
    const { prisma, updated } = fakePrisma(stored);
    await new FormsService(prisma).saveProjectDraft(draftInput({ step: 4, draftId: 'lead-1', draftToken: token }));
    expect(updated[0]?.data.activities).toBeUndefined();
  });

  it('starts a new brief when the token does not match, rather than writing to someone else’s lead', async () => {
    const stored = { id: 'lead-1', answers: { draft: { token: 'token-1', step: 3 } } };
    const { prisma, lead } = fakePrisma(stored);
    const result = await new FormsService(prisma).saveProjectDraft(
      draftInput({ step: 3, draftId: 'lead-1', draftToken: 'guessed' }),
    );
    expect(lead.update).not.toHaveBeenCalled();
    expect(result.draft?.id).toBe('lead-new');
  });

  it('never writes to a brief that was already sent', async () => {
    const stored = {
      id: 'lead-1',
      answers: { draft: { token: 'token-1', step: 6, completedAt: '2026-09-15T10:00:00.000Z' } },
    };
    const { prisma, lead } = fakePrisma(stored);
    await new FormsService(prisma).saveProjectDraft(draftInput({ step: 6, draftId: 'lead-1', draftToken: 'token-1' }));
    expect(lead.update).not.toHaveBeenCalled();
    expect(lead.create).toHaveBeenCalledTimes(1);
  });

  it('stores nothing when the honeypot is filled, and issues no token', async () => {
    const { prisma, lead } = fakePrisma();
    const result = await new FormsService(prisma).saveProjectDraft(draftInput({ referenceCode: 'bot' }));
    expect(result).toEqual({ status: 'saved', draft: null });
    expect(lead.create).not.toHaveBeenCalled();
    expect(lead.findFirst).not.toHaveBeenCalled();
  });

  it('does not look for a brief when the browser holds no token', async () => {
    const { prisma, lead } = fakePrisma();
    await new FormsService(prisma).saveProjectDraft(draftInput({ draftId: 'lead-1' }));
    expect(lead.findFirst).not.toHaveBeenCalled();
    expect(lead.create).toHaveBeenCalledTimes(1);
  });
});
