import type { BookingManageView, BookingSlotsView } from '@calwebtech/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CancelForm } from './cancel-form';
import { ManagePage, callWhen } from './manage-page';
import { RescheduleForm } from './reschedule-form';

// The server actions reach the API; only they are stubbed, so the forms are the ones the pages render.
vi.mock('./manage-actions', () => ({
  moveCall: () => Promise.resolve({ status: 'idle' }),
  cancelCall: () => Promise.resolve({ status: 'idle' }),
}));

/**
 * The two signed-link pages (docs/08-decisions.md, 60): the call they are about, stated in
 * the zone it was booked in, and the one thing each lets the visitor do.
 */
const view: BookingManageView = {
  action: 'reschedule',
  consultationTypeSlug: 'consultation',
  consultationType: 'Discovery call',
  durationMinutes: 30,
  startsAt: '2026-09-24T15:45:00.000Z',
  endsAt: '2026-09-24T16:15:00.000Z',
  timezone: 'America/Los_Angeles',
  open: true,
  cancelled: false,
};

const slots: BookingSlotsView = {
  consultationType: { slug: 'consultation', name: 'Discovery call', durationMinutes: 30, description: null },
  timeZone: 'America/Los_Angeles',
  days: [
    {
      day: '2026-09-24',
      slots: [
        { startsAt: '2026-09-24T15:45:00.000Z', endsAt: '2026-09-24T16:15:00.000Z' },
        { startsAt: '2026-09-24T17:00:00.000Z', endsAt: '2026-09-24T17:30:00.000Z' },
      ],
    },
  ],
};

describe('the signed-link pages', () => {
  it('state the call in the zone it was booked in, named', () => {
    expect(callWhen(view.startsAt, view.timezone)).toMatch(/^Thursday 24 September at 0?8:45\s?(am )?(PDT|GMT-7)$/i);
    expect(callWhen(view.startsAt, 'Mars/Olympus')).toContain('UTC');
  });

  it('show one heading, the call, and what the page is for, and hide the closing band', () => {
    const html = renderToStaticMarkup(
      <ManagePage title="Move your call" intro="Choose another time." view={view}>
        <p>form</p>
      </ManagePage>,
    );
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('30 minutes');
    expect(html).toContain('Discovery call');
    expect(html).toContain('data-page-has-own-form');
  });

  it('offer every free time but the one the call already has', () => {
    const html = renderToStaticMarkup(
      <RescheduleForm token="test-token-000000000000" slots={slots} current={view.startsAt} typeSlug="consultation" />,
    );
    expect(html.match(/<li><button/g)).toHaveLength(1);
    expect(html).toContain('name="token" value="test-token-000000000000"');
    expect(html).toContain('Move my call');
  });

  it('say so when the only free time is the call’s own', () => {
    const own: BookingSlotsView = { ...slots, days: [{ day: '2026-09-24', slots: [slots.days[0]?.slots[0] ?? { startsAt: '', endsAt: '' }] }] };
    const html = renderToStaticMarkup(
      <RescheduleForm token="test-token-000000000000" slots={own} current={view.startsAt} typeSlug="consultation" />,
    );
    expect(html).not.toContain('<form');
  });

  it('cancel with one button that carries the token', () => {
    const html = renderToStaticMarkup(<CancelForm token="test-token-000000000000" bookAgainHref="/book-a-consultation/" />);
    expect(html).toContain('name="token" value="test-token-000000000000"');
    expect(html).toContain('Cancel this call');
  });
});
