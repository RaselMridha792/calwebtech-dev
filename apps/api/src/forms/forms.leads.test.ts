import { leadSubmissionSchema, type LeadSubmissionInput } from '@calwebtech/shared';
import { describe, expect, it, vi } from 'vitest';
import { LeadsService } from '../leads/leads.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailQueue } from '../queue/email-queue';
import type { SettingsService } from '../settings/settings.service';
import type { TurnstileService } from '../turnstile/turnstile.service';
import { openProjectDraft } from './forms.draft';

/*
 * The forms family's half of the lead flow (docs/10-site-pages.md): the brief's final submit
 * carries the draft the API stored while the visitor was still filling it in, and completes
 * that same lead instead of creating a second one. Everything else about `POST /leads` is
 * the foundation's, and is covered by apps/api/src/leads.
 */

interface StoredLead {
  id: string;
  answers: unknown;
}

function leadsServiceWith(existing: StoredLead | null = null) {
  const created: { data: Record<string, unknown> }[] = [];
  const updated: { where: { id: string }; data: Record<string, unknown> }[] = [];
  const lead = {
    findFirst: vi.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(existing && existing.id === where.id ? existing : null),
    ),
    create: vi.fn((args: { data: Record<string, unknown> }) => {
      created.push(args);
      return Promise.resolve({ id: 'lead-new', createdAt: new Date('2026-09-15T10:05:00.000Z') });
    }),
    update: vi.fn((args: { where: { id: string }; data: Record<string, unknown> }) => {
      updated.push(args);
      return Promise.resolve({ id: args.where.id, createdAt: new Date('2026-09-15T10:00:00.000Z') });
    }),
  };
  const client = {
    lead,
    contact: { upsert: vi.fn(() => Promise.resolve({ id: 'contact-1' })) },
    enquiryType: { findUnique: vi.fn(() => Promise.resolve(null)) },
    landingPage: { findUnique: vi.fn(() => Promise.resolve(null)) },
    service: { findFirst: vi.fn(() => Promise.resolve(null)) },
    setting: { findUnique: vi.fn(() => Promise.resolve(null)) },
    leadActivity: { create: vi.fn(() => Promise.resolve({ id: 'activity-1' })) },
    $transaction: (run: (tx: unknown) => Promise<unknown>) => run(client),
  };
  const enqueue = vi.fn(() => Promise.resolve());
  const service = new LeadsService(
    { client } as unknown as PrismaService,
    { verify: vi.fn(() => Promise.resolve('passed')) } as unknown as TurnstileService,
    { leadNotificationRecipients: vi.fn(() => Promise.resolve(['sales@example.com'])) } as unknown as SettingsService,
    { enqueue } as unknown as EmailQueue,
  );
  return { service, lead, created, updated, enqueue };
}

function submission(overrides: Partial<LeadSubmissionInput> = {}) {
  return leadSubmissionSchema.parse({
    type: 'PROJECT',
    formId: 'start-a-project',
    name: 'Dana Whitfield',
    email: 'dana@example.com',
    ...overrides,
  });
}

const openDraft = {
  id: 'lead-1',
  answers: {
    projectLinks: 'https://example.com/brief',
    draft: { token: 'token-1', step: 6, furthestStep: 6, formId: 'start-a-project', startedAt: '2026-09-15T10:00:00.000Z' },
  },
};

describe('POST /leads completing a saved brief', () => {
  it('completes the stored brief instead of creating a second lead', async () => {
    const { service, lead, updated, enqueue } = leadsServiceWith(openDraft);
    await expect(
      service.create(submission({ draftId: 'lead-1', draftToken: 'token-1', message: 'Nine pages.' }), '203.0.113.7'),
    ).resolves.toEqual({ status: 'received' });

    expect(lead.create).not.toHaveBeenCalled();
    const data = updated[0]?.data ?? {};
    expect(data).toMatchObject({ message: 'Nine pages.', type: 'PROJECT' });
    // The brief is marked complete, so progressive saving can never write to it again.
    expect(openProjectDraft(data.answers, 'token-1')).toBeNull();
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('keeps the answers the draft collected and adds the ones the submit carries', async () => {
    const { service, updated } = leadsServiceWith(openDraft);
    await service.create(
      submission({ draftId: 'lead-1', draftToken: 'token-1', projectLinks: 'https://example.com/brief-v2' }),
      undefined,
    );
    expect(updated[0]?.data.answers).toMatchObject({
      projectLinks: 'https://example.com/brief-v2',
      draft: { startedAt: '2026-09-15T10:00:00.000Z', furthestStep: 6 },
    });
  });

  it('creates a lead when the token does not match the stored brief', async () => {
    const { service, lead } = leadsServiceWith(openDraft);
    await service.create(submission({ draftId: 'lead-1', draftToken: 'guessed' }), undefined);
    expect(lead.update).not.toHaveBeenCalled();
    expect(lead.create).toHaveBeenCalledTimes(1);
  });

  it('creates a lead when the brief was already completed, so a resubmit is a second enquiry', async () => {
    const completed = {
      id: 'lead-1',
      answers: { draft: { token: 'token-1', step: 6, completedAt: '2026-09-15T10:01:00.000Z' } },
    };
    const { service, lead } = leadsServiceWith(completed);
    await service.create(submission({ draftId: 'lead-1', draftToken: 'token-1' }), undefined);
    expect(lead.update).not.toHaveBeenCalled();
    expect(lead.create).toHaveBeenCalledTimes(1);
  });

  it('looks for no brief when the form sends no draft, which is every other form', async () => {
    const { service, lead, created } = leadsServiceWith();
    await service.create(submission({ type: 'CONTACT', formId: 'contact-page' }), undefined);
    expect(lead.findFirst).not.toHaveBeenCalled();
    expect(created[0]?.data.answers).toBeUndefined();
  });
});

describe('POST /leads with the forms family fields', () => {
  it('stores the audit answers that have no column of their own', async () => {
    const { service, created } = leadsServiceWith();
    await service.create(
      submission({
        type: 'AUDIT',
        formId: 'free-website-audit',
        siteUrl: 'example.com',
        mainConcern: 'search-visibility',
        competitorUrl: 'competitor.com',
      }),
      undefined,
    );
    expect(created[0]?.data).toMatchObject({
      type: 'AUDIT',
      siteUrl: 'https://example.com',
      answers: { mainConcern: 'search-visibility', competitorUrl: 'https://competitor.com' },
    });
  });

  it('stores the project type on its own column and the links beside it', async () => {
    const { service, created } = leadsServiceWith();
    await service.create(submission({ projectType: 'ecommerce', projectLinks: 'https://example.com/brief' }), undefined);
    expect(created[0]?.data).toMatchObject({
      projectType: 'ecommerce',
      answers: { projectLinks: 'https://example.com/brief' },
    });
  });
});
