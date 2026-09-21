import type { FinalPointIcon, SiteChromeView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { BackdropImage } from '../ui/brand';
import { CalendarIcon, ShieldIcon, TickIcon } from '../ui/icons';
import { reveal } from '../ui/primitives';

const POINT_ICONS: Record<FinalPointIcon, ReactNode> = {
  check: <TickIcon className="h-4 w-4" />,
  shield: <ShieldIcon className="h-4 w-4" />,
  calendar: <CalendarIcon className="h-4 w-4" />,
};

/**
 * The band closing every site page, rendered by the site layout after `<main>`. It is a
 * labelled region, so its content sits in a landmark. A page that is itself the
 * conversion point renders `PageHasOwnForm`, which hides it.
 */
export function ConversionBand({ band }: { band: SiteChromeView['conversionBand'] }) {
  return (
    <section
      data-conversion-band=""
      aria-labelledby="conversion-band-heading"
      className="content-auto relative overflow-hidden border-t border-hairline bg-canvas-sunken py-20 lg:py-24"
    >
      <div className="absolute inset-0" aria-hidden="true">
        <BackdropImage image={band.backgroundImage} className="opacity-[.13]" />
        {band.backgroundImage ? <div className="absolute inset-0 bg-linear-to-r from-canvas-sunken via-canvas-sunken/92 to-canvas-sunken/70" /> : null}
      </div>
      <div className="shell relative grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7" {...reveal()}>
          <h2
            id="conversion-band-heading"
            className="max-w-[20ch] font-display text-[34px] leading-[1.08] font-extrabold text-ink lg:text-[44px]"
          >
            {band.heading}
          </h2>
          <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed">{band.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={band.primaryCta.href}
              className="button-label inline-flex h-14 items-center bg-navy-900 px-7 text-ink-invert transition-colors duration-150 hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {band.primaryCta.label}
            </a>
            {band.secondaryCta ? (
              <a
                href={band.secondaryCta.href}
                className="button-label inline-flex h-14 items-center border border-hairline-strong px-7 text-ink transition-colors duration-150 hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {band.secondaryCta.label}
              </a>
            ) : null}
          </div>
        </div>
        {band.points.length > 0 ? (
          <ul className="space-y-5 border-t border-hairline pt-8 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12" {...reveal(1)}>
            {band.points.map((point) => (
              <li key={point.title} className="flex gap-4">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center border border-hairline bg-canvas-raised text-ink"
                  aria-hidden="true"
                >
                  {POINT_ICONS[point.icon]}
                </span>
                <span>
                  <b className="block text-ink">{point.title}</b>
                  <span className="text-[14.5px]">{point.body}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Renders nothing visible. Put it on a page that is itself the conversion point (the
 * contact form, thank-you pages): the closing band and the floating call to action are
 * hidden with CSS (`app/globals.css`), so the page ships no script for it.
 */
export function PageHasOwnForm() {
  return <span data-page-has-own-form="" hidden />;
}
