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
  white: 'bg-white',
  tint: 'border-y border-line bg-linear-to-b from-mist2 via-mist to-mist2',
  mist: 'border-y border-line bg-mist2',
  ink: 'bg-ink text-white',
  band: 'band-gradient text-white',
};

function Backdrop({ tone, image }: { tone: SectionTone; image: DecorativeImage | null }) {
  switch (tone) {
    case 'tint':
      return (
        <div className="absolute inset-0" aria-hidden="true">
          <div className="grid-lines absolute inset-0 opacity-70" />
          <div className="absolute -top-32 -right-24 h-[520px] w-[520px] rounded-full bg-primary/7 blur-3xl" />
        </div>
      );
    case 'ink':
      return (
        <div className="absolute inset-0" aria-hidden="true">
          <BackdropImage image={image} className="opacity-[.16]" />
          <div className="absolute inset-0 bg-linear-to-r from-ink via-ink/92 to-ink/70" />
          <div className="glow-blue absolute inset-0 opacity-60" />
        </div>
      );
    case 'band':
      return (
        <div className="absolute inset-0" aria-hidden="true">
          <BackdropImage image={image} className="opacity-[.14] mix-blend-luminosity" />
          <div className="grid-lines-light absolute inset-0" />
          <div className="absolute -bottom-40 -left-20 h-[560px] w-[560px] rounded-full bg-glow-teal-25 blur-3xl" />
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
