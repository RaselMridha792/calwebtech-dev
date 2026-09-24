import { RECIPIENT_STATES } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { type RecipientRow, stateOf, stateWhere, toReportRecipient } from './campaign-report';

const at = (minute: number) => new Date(Date.UTC(2026, 8, 24, 12, minute));

function row(overrides: Partial<RecipientRow> = {}): RecipientRow {
  return {
    id: 'r1',
    email: 'ava@example.com',
    error: null,
    sentAt: null,
    deliveredAt: null,
    openedAt: null,
    clickedAt: null,
    bouncedAt: null,
    complainedAt: null,
    failedAt: null,
    subscriber: { name: 'Ava Stone' },
    ...overrides,
  };
}

describe('recipient state', () => {
  it('is the furthest thing that happened', () => {
    expect(stateOf(row())).toBe('pending');
    expect(stateOf(row({ sentAt: at(1) }))).toBe('sent');
    expect(stateOf(row({ sentAt: at(1), deliveredAt: at(2) }))).toBe('delivered');
    expect(stateOf(row({ sentAt: at(1), deliveredAt: at(2), openedAt: at(3) }))).toBe('opened');
    expect(stateOf(row({ sentAt: at(1), deliveredAt: at(2), openedAt: at(3), clickedAt: at(4) }))).toBe('clicked');
    expect(stateOf(row({ failedAt: at(1), error: 'suppressed' }))).toBe('not_sent');
  });

  it('puts a bounce or a complaint above everything else', () => {
    expect(stateOf(row({ sentAt: at(1), openedAt: at(2), complainedAt: at(3) }))).toBe('complained');
    expect(stateOf(row({ sentAt: at(1), bouncedAt: at(2) }))).toBe('bounced');
    expect(stateOf(row({ sentAt: at(1), bouncedAt: at(2), complainedAt: at(3) }))).toBe('complained');
  });

  it('has a filter for every state', () => {
    for (const state of RECIPIENT_STATES) expect(Object.keys(stateWhere(state)).length).toBeGreaterThan(0);
  });

  it('reports the latest event and the subscriber name', () => {
    const view = toReportRecipient(row({ sentAt: at(1), deliveredAt: at(2), openedAt: at(9) }));
    expect(view.lastEventAt).toBe(at(9).toISOString());
    expect(view.name).toBe('Ava Stone');
  });
});
