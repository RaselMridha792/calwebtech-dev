import type { DecorativeImage } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { BackdropImage } from '../ui/brand';

/** Whether a component sits on a light or a dark ground, which sets its text colours. */
export type Ground = 'light' | 'dark';

/**
 * The section treatments of the approved pages (docs/05-design-system.md, Section rhythm):
 * white; tinted gradient with grid texture; light tint; image with navy overlay; colour
 * band. Never put two sections with the same tone next to each other.
 */
export type SectionTone = 'white' | 'tint' | 'mist' | 'ink' | 'band';

export const groundOf = (tone: SectionTone): Ground => (tone === 'ink' || tone === 'band' ? 'dark' : 'light');

const TONES: Record<SectionTone, string> = {
  white: 'bg-canvas-raised',
  tint: 'border-y border-hairline bg-canvas-sunken',
  mist: 'border-y border-hairline bg-canvas-raised',
  ink: 'bg-navy-900 text-ink-invert',
  band: 'band-gradient text-ink-invert',
};

function Backdrop({ tone, image }: { tone: SectionTone; image: DecorativeImage | null }) {
  switch (tone) {
    case 'tint':
      return (
        <div className="absolute inset-0" aria-hidden="true">
        </div>
      );
    case 'ink':
      return (
        <div className="absolute inset-0" aria-hidden="true">
          <BackdropImage image={image} className="opacity-[.16]" />
          <div className="absolute inset-0 bg-linear-to-r from-navy-900 via-navy-900/92 to-navy-900/70" />
        </div>
      );
    case 'band':
      return (
        <div className="absolute inset-0" aria-hidden="true">
          <BackdropImage image={image} className="opacity-[.14] mix-blend-luminosity" />
        </div>
      );
    default:
      return null;
  }
}

/**
 * A full-bleed page section with contained content. Below-the-fold sections skip rendering
 * until they approach the viewport (`content-auto`); pass `deferred={false}` for anything
 * that can hold the LCP element. Give it an `id` when navigation links to it, and
 * `labelledBy` with the id of its heading.
 */
export function Section({
  id,
  tone = 'white',
  backdrop = null,
  labelledBy,
  deferred = true,
  className = '',
  children,
}: {
  id?: string;
  tone?: SectionTone;
  /** A decorative photograph under the ink or band overlays. */
  backdrop?: DecorativeImage | null;
  labelledBy?: string;
  deferred?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`${deferred ? 'content-auto ' : ''}relative overflow-hidden py-20 lg:py-28 ${TONES[tone]} ${className}`}
    >
      <Backdrop tone={tone} image={backdrop} />
      <div className="shell relative">{children}</div>
    </section>
  );
}
