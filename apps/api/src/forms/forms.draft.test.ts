import { formsProjectDraftSchema, type FormsProjectDraft } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import {
  asJsonObject,
  completedDraftAnswers,
  openProjectDraft,
  projectDraftAnswers,
  projectDraftAttribution,
  projectDraftFields,
} from './forms.draft';

const now = new Date('2026-09-15T10:00:00.000Z');
const later = new Date('2026-09-15T10:04:00.000Z');

function draft(overrides: Partial<FormsProjectDraft> = {}): FormsProjectDraft {
  return formsProjectDraftSchema.parse({
    formId: 'start-a-project',
    step: 2,
    name: 'Dana Whitfield',
    email: 'dana@example.com',
    serviceInterest: [],
    ...overrides,
  });
}

describe('openProjectDraft', () => {
  const stored = { projectLinks: 'https://example.com/brief', draft: { token: 'token-1', step: 3 } };

  it('opens the brief when the token is the one the API issued', () => {
    const open = openProjectDraft(stored, 'token-1');
    expect(open?.draft.step).toBe(3);
    expect(open?.answers).toEqual({ projectLinks: 'https://example.com/brief' });
  });

  it('refuses a guessed or stale token, and a brief that was already completed', () => {
    expect(openProjectDraft(stored, 'token-2')).toBeNull();
    expect(openProjectDraft(stored, undefined)).toBeNull();
    expect(openProjectDraft({ draft: { token: 'token-1', completedAt: now.toISOString() } }, 'token-1')).toBeNull();
  });

  it('refuses answers that hold no draft at all, so an ordinary lead is never overwritten', () => {
    expect(openProjectDraft({ enquiryType: 'support' }, 'token-1')).toBeNull();
    expect(openProjectDraft(null, 'token-1')).toBeNull();
    expect(openProjectDraft('draft', 'token-1')).toBeNull();
    expect(openProjectDraft([{ token: 'token-1' }], 'token-1')).toBeNull();
  });
});

describe('asJsonObject', () => {
  it('reads objects and nothing else', () => {
    expect(asJsonObject({ a: 1 })).toEqual({ a: 1 });
    for (const value of [null, undefined, 'text', 4, [1, 2]]) expect(asJsonObject(value)).toEqual({});
  });
});

describe('projectDraftFields', () => {
  it('clears an answer the visitor went back and removed', () => {
    const fields = projectDraftFields(draft({ step: 4, budgetBand: undefined, company: undefined }));
    expect(fields.budgetBand).toBeNull();
    expect(fields.company).toBeNull();
    expect(fields.serviceInterest).toEqual([]);
  });

  it('keeps the answers that were given', () => {
    const fields = projectDraftFields(
      draft({ projectType: 'redesign', budgetBand: '25k-60k', timeline: 'this-quarter', message: 'Two pages.' }),
    );
    expect(fields).toMatchObject({
      projectType: 'redesign',
      budgetBand: '25k-60k',
      timeline: 'this-quarter',
      message: 'Two pages.',
      name: 'Dana Whitfield',
      email: 'dana@example.com',
    });
  });
});

describe('projectDraftAnswers', () => {
  it('starts the bookkeeping on the first save', () => {
    const answers = projectDraftAnswers(draft(), null, 'token-1', now);
    expect(answers.draft).toEqual({
      token: 'token-1',
      formId: 'start-a-project',
      step: 2,
      furthestStep: 2,
      startedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });

  it('keeps the furthest step and the start time when the visitor goes back a step', () => {
    const first = projectDraftAnswers(draft({ step: 5 }), null, 'token-1', now);
    const open = openProjectDraft(first, 'token-1');
    const second = projectDraftAnswers(draft({ step: 3 }), open, 'token-1', later);
    expect(second.draft).toMatchObject({
      step: 3,
      furthestStep: 5,
      startedAt: now.toISOString(),
      updatedAt: later.toISOString(),
    });
  });

  it('carries the links forward and clears them when they are removed', () => {
    const first = projectDraftAnswers(draft({ projectLinks: 'https://example.com/brief' }), null, 'token-1', now);
    expect(first.projectLinks).toBe('https://example.com/brief');
    const open = openProjectDraft(first, 'token-1');
    expect(projectDraftAnswers(draft(), open, 'token-1', later).projectLinks).toBeNull();
  });
});

describe('completedDraftAnswers', () => {
  it('marks the brief complete and keeps what was stored on the way', () => {
    const open = openProjectDraft(projectDraftAnswers(draft({ step: 6 }), null, 'token-1', now), 'token-1');
    expect(open).not.toBeNull();
    const answers = completedDraftAnswers(open ?? { answers: {}, draft: {} }, { mainConcern: 'slow-on-mobile' }, later);
    expect(answers).toMatchObject({
      mainConcern: 'slow-on-mobile',
      draft: { token: 'token-1', furthestStep: 6, completedAt: later.toISOString() },
    });
    // The completed brief can never be written to again.
    expect(openProjectDraft(answers, 'token-1')).toBeNull();
  });
});

describe('projectDraftAttribution', () => {
  it('writes the same shape the leads service does', () => {
    const input = draft({
      attribution: { lastTouch: { source: 'google' }, landingPage: '/start-a-project/', device: 'mobile' },
    });
    expect(projectDraftAttribution(input)).toEqual({
      firstTouchUtm: undefined,
      lastTouchUtm: { source: 'google' },
      referrer: undefined,
      landingPage: '/start-a-project/',
      device: 'mobile',
      formId: 'start-a-project',
    });
  });
});
