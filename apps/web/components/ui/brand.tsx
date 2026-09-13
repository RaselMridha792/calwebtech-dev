import type { DecorativeImage } from '@calwebtech/shared';
import { ResponsiveImage } from './responsive-image';

/** Logo mark and name. Below 400px the name is visually hidden to fit the header. */
export function Wordmark({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const dark = tone === 'dark';
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`grid h-9 w-9 place-items-center rounded-lg font-display text-lg font-extrabold ${dark ? 'bg-ink text-white' : 'bg-white text-ink'}`}
        aria-hidden="true"
      >
        C
      </span>
      <span
        className={`font-display font-extrabold ${dark ? 'text-[21px] text-ink max-[399px]:sr-only' : 'text-[20px] text-white'}`}
      >
        Calwebtech
      </span>
    </span>
  );
}

/**
 * Full-bleed decorative photograph behind a section. Always empty alt.
 *
 * These sit at 13–30% opacity under gradients and are cropped with object-cover,
 * so a small, lower-quality source looks the same. It matters for LCP: the hero
 * backdrop is the LCP element on mobile, and its bytes share the simulated
 * connection with the whole initial payload.
 */
export function BackdropImage({
  image,
  className,
  priority = false,
}: {
  image: DecorativeImage | null;
  className: string;
  priority?: boolean;
}) {
  if (!image) return null;
  return (
    <ResponsiveImage
      src={image.src}
      alt=""
      fill
      sizes="(min-width: 1024px) 100vw, 50vw"
      quality={50}
      priority={priority}
      className={`object-cover ${className}`}
    />
  );
}
