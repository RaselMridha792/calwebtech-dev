import Link from 'next/link';
import type { ReactNode } from 'react';
import { CARD } from './styles';

/*
 * The overview's figures and charts, drawn as SVG and plain boxes on the server. A chart
 * library would be most of a route's 20 kB own-code budget for four shapes, and none of
 * these needs a browser to draw it.
 *
 * Every chart is decorative beside a sentence or a table that says the same thing, so the
 * figure is never only in the picture.
 */

/** A line of points scaled into a small box, with a faint fill under it. */
export function Sparkline({ points, className = '' }: { points: readonly number[]; className?: string }) {
  const width = 112;
  const height = 36;
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const step = width / (points.length - 1);
  const coords = points.map((point, index) => [
    Math.round(index * step * 10) / 10,
    Math.round((height - 3 - (point / max) * (height - 8)) * 10) / 10,
  ]);
  const line = `M${coords.map(([x, y]) => `${String(x)} ${String(y)}`).join('L')}`;
  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      width={width}
      height={height}
      aria-hidden
      focusable="false"
      className={`shrink-0 text-admin-dot ${className}`}
    >
      <path d={`${line}L${String(width)} ${String(height)}L0 ${String(height)}Z`} fill="currentColor" fillOpacity={0.14} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type DeltaTone = 'up' | 'down' | 'flat';

/**
 * A headline figure: what it counts, the number, how it moved, and a sparkline. The whole
 * card is a link to the screen the figure comes from.
 */
export function StatCard({
  label,
  value,
  delta,
  note,
  href,
  points,
}: {
  label: string;
  value: ReactNode;
  delta?: { text: string; tone: DeltaTone } | null;
  note?: ReactNode;
  href?: string;
  points?: readonly number[];
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-[13px] text-ink-invert-muted">
        {label}
        {href ? (
          <span aria-hidden className="text-admin-muted transition-transform duration-150 group-hover:translate-x-0.5">
            →
          </span>
        ) : null}
      </span>
      <span className="flex items-end justify-between gap-3">
        <span className="font-display text-[28px] leading-none font-extrabold tracking-[-0.02em] text-ink-invert tabular-nums sm:text-[32px]">
          {value}
        </span>
        {points ? <Sparkline points={points} className="hidden sm:block" /> : null}
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
        {delta ? <DeltaText delta={delta} /> : null}
        {note ? <span className="text-admin-muted">{note}</span> : null}
      </span>
    </>
  );
  const shape = `${CARD} group flex min-w-0 flex-col gap-3 p-4 sm:p-5`;
  return href ? (
    <Link href={href} className={`${shape} transition-colors duration-150 hover:border-admin-line hover:bg-admin-hover`}>
      {body}
    </Link>
  ) : (
    <div className={shape}>{body}</div>
  );
}

/**
 * Up is teal and down is the danger tone, each with an arrow, so the direction never rests
 * on colour. Teal is an outcome figure here, bold, as the teal-usage rule allows.
 */
function DeltaText({ delta }: { delta: { text: string; tone: DeltaTone } }) {
  if (delta.tone === 'up') return <span className="font-bold text-result">▲ {delta.text}</span>;
  if (delta.tone === 'down') return <span className="font-bold text-danger">▼ {delta.text}</span>;
  return <span className="font-bold text-ink-invert">{delta.text}</span>;
}

/**
 * One bar per day. The last bar is today and carries the champagne, the one gold mark in
 * the chart. Each bar has a title for a pointer; the card beside it states the totals.
 */
export function DailyBars({
  days,
  label,
}: {
  days: readonly { day: string; count: number }[];
  label: (day: string) => string;
}) {
  const max = Math.max(...days.map((day) => day.count), 1);
  return (
    <div aria-hidden className="flex h-[168px] items-end gap-[3px] border-b border-admin-line pb-px sm:gap-1.5">
      {days.map((day, index) => {
        const today = index === days.length - 1;
        const height = day.count === 0 ? 4 : Math.max(8, Math.round((day.count / max) * 160));
        return (
          <span
            key={day.day}
            title={`${label(day.day)}: ${String(day.count)}`}
            style={{ height }}
            className={`min-w-0 flex-1 rounded-t-[3px] ${
              today ? 'bg-gold-500' : day.count > 0 ? 'bg-admin-dot' : 'bg-admin-mist'
            }`}
          />
        );
      })}
    </div>
  );
}

/** A thin horizontal bar, filled to a share of the largest, for ranked lists. */
export function ShareBar({ share }: { share: number }) {
  // Nothing is drawn for nothing; anything else shows at least a sliver.
  const width = share <= 0 ? '0%' : `${String(Math.max(2, Math.min(100, Math.round(share * 100))))}%`;
  return (
    <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-admin-sunken">
      <span className="block h-full rounded-full bg-admin-dot" style={{ width }} />
    </span>
  );
}
