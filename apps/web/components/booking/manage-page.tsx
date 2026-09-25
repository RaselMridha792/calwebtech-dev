import type { BookingManageView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { PageHasOwnForm } from '../site/conversion-band';

/**
 * The frame of the two signed-link pages (docs/08-decisions.md, 60): what the page is for, the
 * call it is about, and the one thing it lets the visitor do. The call's time is stated in the
 * zone it was booked in, named, as the confirmation email states it.
 */
export function callWhen(startsAt: string, timezone: string): string {
  const zone = knownZone(timezone);
  const at = new Date(startsAt);
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: zone }).format(at);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: zone,
  }).format(at);
  return `${day} at ${time}`;
}

function knownZone(timezone: string): string {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
    return timezone;
  } catch {
    return 'UTC';
  }
}

export function ManagePage({
  title,
  intro,
  view,
  children,
}: {
  title: string;
  intro: string;
  view: BookingManageView;
  children: ReactNode;
}) {
  const rows: [string, string][] = [
    ['When', callWhen(view.startsAt, view.timezone)],
    ['Length', `${String(view.durationMinutes)} minutes`],
    ['Call', view.consultationType],
  ];

  return (
    <section className="bg-canvas pt-16 pb-24 lg:pt-24 lg:pb-32">
      {/* The page is its own task; the closing band and the floating button would only
          offer to book a call to someone managing the one they have. */}
      <PageHasOwnForm />
      <div className="shell">
        <p className="eyebrow text-gold-ink">Your call</p>
        <h1 className="display-md mt-4 max-w-[20ch] text-ink">{title}</h1>
        <p className="body-lg mt-5 max-w-[46rem] text-ink-muted">{intro}</p>

        <dl className="mt-10 max-w-[46rem]">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 border-t border-hairline py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
              <dt className="eyebrow text-ink-muted">{label}</dt>
              <dd className="body-lg text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        {view.cancelled ? (
          <p className="body-lg mt-2 max-w-[46rem] border-t border-hairline pt-4 text-ink">This call is cancelled.</p>
        ) : null}

        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}
