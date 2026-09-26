import type { AdminOverview } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { attention, delta, greeting, summaryLine } from './summary';

const days = Array.from({ length: 30 }, (_, index) => ({ day: `2026-09-${String(index + 1).padStart(2, '0')}`, count: 0 }));

function overview(parts: Partial<AdminOverview> = {}): AdminOverview {
  return {
    generatedAt: '2026-09-26T16:00:00.000Z',
    timeZone: 'America/Los_Angeles',
    leads: null,
    bookings: null,
    audience: null,
    campaigns: null,
    content: null,
    media: null,
    ...parts,
  };
}

const leads = (unassignedNew: number, overdue: number): AdminOverview['leads'] => ({
  week: { current: 3, previous: 2 },
  month: { current: 9, previous: 0 },
  daily: days,
  byStatus: { NEW: 3, CONTACTED: 0, QUALIFIED: 0, PROPOSAL_SENT: 0, WON: 0, LOST: 0 },
  byChannel: [],
  latest: [],
  unassignedNew,
  overdue,
});

/** The overview's sentences, worked out from its figures (docs/08-decisions.md, 63). */
describe('the overview summary', () => {
  it('greets by the first name, on the business clock', () => {
    // 16:00 UTC is 09:00 in Los Angeles.
    expect(greeting(new Date('2026-09-26T16:00:00Z'), 'America/Los_Angeles', 'Mirza Hasan')).toBe('Good morning, Mirza');
    expect(greeting(new Date('2026-09-26T16:00:00Z'), 'Asia/Dhaka', 'Mirza Hasan')).toBe('Good evening, Mirza');
  });

  it('says what is waiting, or that nothing is', () => {
    expect(summaryLine(overview({ leads: leads(2, 0) }))).toBe('2 new leads are waiting for an owner.');
    expect(summaryLine(overview({ leads: leads(0, 0) }))).toMatch(/^Everything is up to date/);
  });

  it('states a change as a rise, a fall, level, or new', () => {
    expect(delta({ current: 3, previous: 2 })).toEqual({ text: '50%', tone: 'up' });
    expect(delta({ current: 1, previous: 2 })).toEqual({ text: '50%', tone: 'down' });
    expect(delta({ current: 2, previous: 2 })).toEqual({ text: 'Level', tone: 'flat' });
    expect(delta({ current: 4, previous: 0 })).toEqual({ text: 'New', tone: 'up' });
    expect(delta({ current: 0, previous: 0 })).toBeNull();
  });

  it('puts an overdue follow-up first and links each item to where it is dealt with', () => {
    const items = attention(
      overview({
        leads: leads(4, 1),
        content: { families: [{ kind: 'service', published: 3, unpublished: 2 }], recent: [], scheduledPast: 0 },
      }),
      false,
    );
    expect(items.map((item) => item.title)).toEqual([
      '1 follow-up is overdue',
      '4 new leads have no owner',
      '2 services are not published',
      'Search engines cannot see the site',
    ]);
    expect(items[1]?.href).toBe('/admin/leads/?status=NEW&owner=unassigned');
  });

  it('asks nothing of a role that cannot see a module', () => {
    expect(attention(overview(), null)).toEqual([]);
  });
});
