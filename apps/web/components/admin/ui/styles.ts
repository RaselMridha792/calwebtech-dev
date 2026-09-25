/*
 * The dashboard's visual vocabulary, as class strings every screen composes from
 * (docs/08-decisions.md, 63). Plain strings rather than components so a client form and a
 * server listing can share them without either paying for the other, and so a screen that
 * needs one more class can still add it.
 *
 * Only existing tokens: the admin's navy steps for surfaces, the brand's cream for text and
 * its champagne for the one action that matters on a screen — the same gold-on-navy button
 * the marketing hero uses. Separation is by surface step and a 1px line; the only shadow is
 * the brand's `shadow-plate`, and only under something that floats (a menu, a dialog).
 */

/** A raised panel: every group of related content sits on one. */
export const CARD = 'rounded-xl border border-admin-line2 bg-admin-surface';

/** A card's own inner padding, tighter on a phone. */
export const CARD_PAD = 'p-4 sm:p-6';

/** Headings inside a card or a page section. */
export const H2 = 'font-display text-[17px] font-bold tracking-[-0.01em] text-ink-invert';
export const H3 = 'font-display text-[15px] font-bold tracking-[-0.005em] text-ink-invert';

/** The small gold line above a page title that names the module group. One per screen. */
export const EYEBROW = 'text-[11.5px] font-semibold tracking-[0.14em] text-gold-500 uppercase';

/** A quiet uppercase label for a group of fields or a column of facts. */
export const KICKER = 'text-[11.5px] font-semibold tracking-[0.12em] text-admin-muted uppercase';

export const BODY = 'text-[14px] leading-[1.6] text-ink-invert-muted';
export const MUTED = 'text-[12.5px] leading-[1.5] text-admin-muted';

/** A text link inside a sentence or at the end of a card. */
export const LINK =
  'font-semibold text-admin-link underline-offset-4 transition-colors duration-150 hover:text-ink-invert hover:underline';

// ---------------------------------------------------------------- form controls

export const LABEL = 'text-[13px] font-semibold text-ink-invert';
export const HELP = 'text-[12.5px] leading-[1.5] text-admin-muted';
export const ERROR = 'text-[12.5px] leading-[1.5] font-semibold text-danger';

const CONTROL =
  'w-full rounded-lg border border-admin-line bg-admin-sunken text-[14px] text-ink-invert transition-colors duration-150 outline-none placeholder:text-admin-muted hover:border-admin-edge disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger';

/** Inputs and selects: 40px, 44px where the pointer is a finger. */
export const INPUT = `${CONTROL} h-10 px-3 pointer-coarse:h-11`;
export const SELECT = `${CONTROL} h-10 pr-8 pl-3 pointer-coarse:h-11`;
export const TEXTAREA = `${CONTROL} px-3 py-2.5 leading-[1.6]`;

/** A checkbox or radio: the browser's own control, in the admin's accent. */
export const CHECK = 'size-4 shrink-0 accent-admin-edge';

// ---------------------------------------------------------------- buttons

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

const BUTTON_BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100';

const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: 'h-10 px-4 text-[14px] pointer-coarse:h-11',
  sm: 'h-8 px-3 text-[13px] pointer-coarse:h-11',
};

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // The brand's action on a dark ground (components/home/hero.tsx): champagne, dark ink.
  primary: 'bg-gold-500 font-bold text-on-gold hover:bg-gold-300',
  secondary: 'border border-admin-line text-ink-invert hover:border-admin-edge hover:bg-admin-hover',
  ghost: 'text-ink-invert-muted hover:bg-admin-hover hover:text-ink-invert',
  danger: 'border border-admin-line text-danger hover:border-danger hover:bg-admin-hover',
};

export function button(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return `${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]}`;
}

/** A square button that holds only an icon; it must carry an `aria-label` or sr-only text. */
export function iconButton(size: ButtonSize = 'md'): string {
  const box = size === 'md' ? 'size-10 pointer-coarse:size-11' : 'size-8 pointer-coarse:size-11';
  return `${BUTTON_BASE} ${box} border border-admin-line text-ink-invert-muted hover:border-admin-edge hover:bg-admin-hover hover:text-ink-invert`;
}

// ---------------------------------------------------------------- small marks

/** A rounded label for a record's state. Pair it with a dot for colour, never colour alone. */
export const PILL =
  'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-admin-mist px-2.5 text-[12px] font-semibold whitespace-nowrap text-ink-invert';

/** A squarer label for a kind or a category: what something is, not how it is doing. */
export const TAG =
  'inline-flex h-6 shrink-0 items-center rounded-md border border-admin-line bg-admin-hover px-2 text-[12px] font-semibold whitespace-nowrap text-ink-invert-muted';

/** A count beside a label: a nav item, a tab, a title. */
export const COUNT =
  'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-admin-mist px-1.5 text-[11.5px] font-semibold text-ink-invert tabular-nums';

// ---------------------------------------------------------------- tables and lists

export const TABLE_WRAP = `${CARD} overflow-hidden`;
export const TH = 'h-10 bg-admin-sunken px-3 text-left text-[12px] font-semibold whitespace-nowrap text-admin-muted';
export const TD = 'h-[52px] border-t border-admin-line2 px-3 text-[14px] text-ink-invert-muted';
export const ROW = 'transition-colors duration-150 hover:bg-admin-hover';

/** A list of records as rows inside one card: the listing pattern for content. */
export const LIST = `${CARD} divide-y divide-admin-line2 overflow-hidden`;
export const LIST_ROW =
  'relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors duration-150 hover:bg-admin-hover sm:px-5';
