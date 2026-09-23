import type { AdminAvailability } from '@calwebtech/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AvailabilityForm } from './availability-form';

// The form refreshes the server component after a save, which needs a mounted router.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

/**
 * The availability screen's own logic is the one conversion in it: minutes from midnight in
 * the business's zone, which is what the slot generator reads, shown as the clock face
 * somebody types. A rule at 540 that renders as 05:40 would quietly move every call.
 */
const availability: AdminAvailability = {
  consultationType: {
    id: 'type-1',
    name: 'Discovery call',
    slug: 'consultation',
    durationMinutes: 30,
    bufferBefore: 0,
    bufferAfter: 15,
    active: true,
  },
  timeZone: 'Europe/London',
  rules: [
    { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 + 30, minimumNoticeHours: 24 },
    { weekday: 1, startMinute: 13 * 60 + 45, endMinute: 17 * 60, minimumNoticeHours: 24 },
    { weekday: 3, startMinute: 10 * 60, endMinute: 16 * 60, minimumNoticeHours: 24 },
  ],
  overrides: [{ id: 'o1', day: '2026-12-25', blocked: true, startMinute: null, endMinute: null, reason: 'Christmas' }],
  horizonDays: 30,
};

describe('the availability screen', () => {
  it('shows each window as the clock face it was written in', () => {
    const html = renderToStaticMarkup(<AvailabilityForm availability={availability} mayWrite />);
    expect(html).toContain('value="09:00"');
    expect(html).toContain('value="12:30"');
    expect(html).toContain('value="13:45"');
    expect(html).toContain('value="16:00"');
  });

  it('says a day with no window is closed, and counts the open ones', () => {
    const html = renderToStaticMarkup(<AvailabilityForm availability={availability} mayWrite />);
    expect(html).toContain('Closed');
    expect(html).toContain('2 of seven days are open');
  });

  it('states the stride and the notice, because that is what a visitor is offered', () => {
    const html = renderToStaticMarkup(<AvailabilityForm availability={availability} mayWrite />);
    // 0 before + 30 minutes + 15 after.
    expect(html).toContain('One start every 45 minutes');
    expect(html).toContain('24 hours from now');
    expect(html).toContain('Europe/London');
  });

  it('carries a blocked date with its reason, and leaves its hours empty', () => {
    const html = renderToStaticMarkup(<AvailabilityForm availability={availability} mayWrite />);
    expect(html).toContain('value="2026-12-25"');
    expect(html).toContain('value="Christmas"');
  });

  it('offers nothing to change when the reader may only read', () => {
    const html = renderToStaticMarkup(<AvailabilityForm availability={availability} mayWrite={false} />);
    expect(html).not.toContain('Save availability');
    expect(html).not.toContain('Add a date');
    expect(html).toContain('read these hours but not change them');
  });

  it('tells the owner plainly when every day is closed', () => {
    const closed = { ...availability, rules: [] };
    const html = renderToStaticMarkup(<AvailabilityForm availability={closed} mayWrite />);
    expect(html).toContain('Every day is closed');
  });
});
