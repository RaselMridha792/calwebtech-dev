import type { DecorativeImage } from '@calwebtech/shared';
import { ResponsiveImage } from './responsive-image';

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
