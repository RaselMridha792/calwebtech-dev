import Link from 'next/link';
import type { ReactNode } from 'react';
import { CARD, CARD_PAD, COUNT, EYEBROW, H2 } from './styles';

/*
 * The frame every admin screen is built in: the scrolling column, the header that says
 * where you are and what you can do, the cards that group what is on it, and what an empty
 * one says. Server components with no state, so they cost nothing in the browser.
 */

const WIDTHS = {
  /** Listings, tables and the overview. */
  wide: 'max-w-[1320px]',
  /** One record's editor. */
  medium: 'max-w-[1120px]',
  /** Settings and other single-column forms. */
  narrow: 'max-w-[880px]',
} as const;

/**
 * The screen's scrolling column, where the skip link lands. Not `#main`: the marketing
 * layout pads that id for its fixed header (globals.css), and the admin has no such header.
 */
export function AdminPage({
  children,
  width = 'wide',
}: {
  children: ReactNode;
  width?: keyof typeof WIDTHS;
}) {
  return (
    <main id="admin-main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
      <div className={`mx-auto flex w-full flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-8 ${WIDTHS[width]}`}>
        {children}
      </div>
    </main>
  );
}

/**
 * Title, one line on what the screen is for, and its actions on the right. The primary
 * action is the rightmost; on a phone they wrap under the title.
 */
export function PageHeader({
  eyebrow,
  title,
  count,
  badge,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  count?: number;
  badge?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 max-w-[760px] flex-col gap-1.5">
        {eyebrow ? <p className={EYEBROW}>{eyebrow}</p> : null}
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-[26px] leading-[1.2] font-extrabold tracking-[-0.025em] text-ink-invert sm:text-[30px]">
          {title}
          {count === undefined ? null : <span className={`${COUNT} font-sans tracking-normal`}>{count}</span>}
          {badge}
        </h1>
        {description ? <div className="text-[14.5px] leading-[1.6] text-ink-invert-muted">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

/** A card with an optional heading row. `flush` drops the padding for a table or list. */
export function Panel({
  title,
  description,
  actions,
  children,
  flush = false,
  className = '',
  labelledBy,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
  /** The id to give the heading, so the section is named by it. */
  labelledBy?: string;
}) {
  const head =
    title || actions ? (
      <div className={`flex flex-wrap items-start justify-between gap-3 ${flush ? 'px-4 pt-5 pb-4 sm:px-6' : 'mb-5'}`}>
        <div className="flex min-w-0 flex-col gap-1">
          {title ? (
            <h2 id={labelledBy} className={H2}>
              {title}
            </h2>
          ) : null}
          {description ? <div className="text-[13.5px] leading-[1.55] text-ink-invert-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    ) : null;
  return (
    <section aria-labelledby={title ? labelledBy : undefined} className={`${CARD} ${flush ? 'overflow-hidden' : CARD_PAD} ${className}`}>
      {head}
      {children}
    </section>
  );
}

/**
 * What an empty screen or card says: what will appear here, why it is empty, and the one
 * thing to do about it. A view narrowed to nothing and a module with nothing in it yet need
 * different sentences, so the caller writes them.
 */
export function EmptyState({
  title,
  children,
  actions,
  icon,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-[460px] flex-col items-center px-6 py-14 text-center">
      <span
        aria-hidden
        className="mb-5 flex size-12 items-center justify-center rounded-full border border-admin-line bg-admin-sunken text-admin-link"
      >
        {icon ?? <span className="size-2 rounded-full bg-gold-500" />}
      </span>
      <h2 className={H2}>{title}</h2>
      {children ? <div className="mt-2 text-[14px] leading-[1.6] text-ink-invert-muted">{children}</div> : null}
      {actions ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

export interface TabLink {
  href: string;
  label: string;
  count?: number;
  current: boolean;
}

/**
 * Tabs that are links: each view has its own address, so it can be bookmarked and the back
 * button works, and switching costs no script.
 */
export function LinkTabs({ tabs, label }: { tabs: TabLink[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-admin-line2">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.current ? 'page' : undefined}
              className={`-mb-px flex h-11 items-center gap-2 border-b-2 px-3 text-[14px] font-semibold transition-colors duration-150 ${
                tab.current
                  ? 'border-gold-500 text-ink-invert'
                  : 'border-transparent text-ink-invert-muted hover:border-admin-line hover:text-ink-invert'
              }`}
            >
              {tab.label}
              {tab.count === undefined ? null : (
                <span className="text-[12px] font-semibold text-admin-muted tabular-nums">{tab.count}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Filter chips that are links, for a short fixed set of values. The current one is marked
 * for a screen reader as well as by its fill.
 */
export function ChipLinks({ chips, label }: { chips: TabLink[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.href}>
            <Link
              href={chip.href}
              aria-current={chip.current ? 'page' : undefined}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-150 pointer-coarse:h-11 ${
                chip.current
                  ? 'border-admin-edge bg-admin-nav text-ink-invert'
                  : 'border-admin-line text-ink-invert-muted hover:border-admin-edge hover:text-ink-invert'
              }`}
            >
              {chip.label}
              {chip.count === undefined ? null : <span className="text-admin-muted tabular-nums">{chip.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A definition list of facts, label beside value, used on detail panels. */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[14px]">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-admin-muted">{item.label}</dt>
          <dd className="min-w-0 break-words text-ink-invert">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A labelled back link above a record's title. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center gap-1.5 self-start rounded-md text-[13.5px] font-semibold text-ink-invert-muted transition-colors duration-150 hover:text-ink-invert"
    >
      <span aria-hidden>←</span>
      {children}
    </Link>
  );
}

