/**
 * The Calwebtech mark (`apps/web/public/brand`, from the logo pack's own rules).
 *
 * The files are outlined paths with no live text, so the wordmark is never re-typed in a
 * web font — it renders identically wherever it goes. They are served as files rather than
 * inlined because the horizontal lockup is 17 kB of path data and it appears on every page.
 *
 * A plain `img`, not `next/image`. There is nothing for the optimiser to do to a vector,
 * and the component costs about 12 kB of client runtime on every route that renders it —
 * which, for a mark that appears in the header of every page, is most of the initial
 * JavaScript budget spent on a shape that is already sharp at any size.
 */

/** Each lockup's intrinsic size, so the space is reserved before the file arrives. */
const LAYOUTS = {
  /**
   * The nav bar, and anywhere under about 48px tall: the horizontal lockup's tagline
   * stops being readable below that, so this drops it. Minimum 110px wide.
   */
  compact: { width: 2098.5, height: 512 },
  /** The default: footer, documents, proposals, OG images. Minimum 160px wide. */
  horizontal: { width: 1873.08, height: 512 },
  /** Square or narrow spaces: social avatars, cover pages, centred layouts. */
  stacked: { width: 1291.08, height: 833.66 },
  /** The emblem alone. Below 24px use the favicon instead. */
  mark: { width: 512, height: 512 },
} as const;

export type LogoLayout = keyof typeof LAYOUTS;

/**
 * Which file to use, by the ground it sits on.
 *
 * - `light` — navy and deep gold, for cream, white or any light colour.
 * - `dark` — cream and champagne, for navy, black or any dark colour.
 * - `mono-cream` / `mono-navy` — over a photograph or plate, and for one-colour print.
 *
 * Champagne gold is only 1.8:1 on cream, so the light files carry `gold-600` instead. That
 * is why there is a file per ground rather than one file recoloured by CSS.
 */
export type LogoTone = 'light' | 'dark' | 'mono-cream' | 'mono-navy';

export function Logo({
  tone,
  layout = 'compact',
  height,
  className,
  priority = false,
}: {
  tone: LogoTone;
  layout?: LogoLayout;
  /** Rendered height in pixels; the width follows the lockup's own ratio. */
  height: number;
  className?: string;
  priority?: boolean;
}) {
  const size = LAYOUTS[layout];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the note above.
    <img
      src={`/brand/calwebtech-${layout}-${tone}.svg`}
      alt="Calwebtech"
      width={Math.round((size.width / size.height) * height)}
      height={height}
      // The header's mark is in the first viewport of every page; everything else waits.
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={className}
    />
  );
}
