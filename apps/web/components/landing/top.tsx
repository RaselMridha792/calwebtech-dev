import type { LandingPageView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { CountUp } from '../motion/count-up';
import { BackgroundVideo } from '../ui/background-video';
import { BackdropImage } from '../ui/brand';
import { Logo } from '../ui/logo';
import { CheckBullet, PillBadge, Stars } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';

type Content = LandingPageView['content'];

/** Minimal header: no site navigation, one way out, and it is the form. */
export function LandingHeader({
  reviews,
  contact,
  ctaLabel,
}: {
  reviews: LandingPageView['reviews'];
  contact: LandingPageView['contact'];
  ctaLabel: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-navy-900-invert/95">
      <div className="shell-narrow flex h-[70px] items-center justify-between gap-4">
        <Logo tone="light" height={34} priority />
        <div className="flex items-center gap-5">
          {reviews.averageRating !== null ? (
            <p className="hidden items-center gap-2 text-[14px] md:flex">
              <Stars rating={reviews.averageRating} announce={false} />
              <span>
                <b className="text-ink">{reviews.averageRating.toFixed(1)}</b> from{' '}
                {reviews.totalReviews} reviews
              </span>
            </p>
          ) : null}
          <a
            href={`tel:${contact.phoneE164}`}
            className="hidden text-[15px] font-semibold text-ink hover:text-gold-ink sm:block"
          >
            {contact.phone}
          </a>
          <a
            href="#form"
            className="inline-flex h-11 items-center bg-navy-900 px-4 text-[14px] font-semibold whitespace-nowrap text-ink-invert hover:bg-navy-700 sm:px-5 sm:text-[14.5px]"
          >
            {ctaLabel}
          </a>
        </div>
      </div>
    </header>
  );
}

export function LandingHero({ hero, form }: { hero: Content['hero']; form: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-navy-900 text-ink-invert">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <BackdropImage image={hero.backgroundImage} className="kenburns opacity-[.34]" priority />
      </div>
      {hero.backgroundVideoUrl ? <BackgroundVideo src={hero.backgroundVideoUrl} className="opacity-60" /> : null}
      {/*
        Copy stays on near-solid ink; the footage shows through on the form side from lg up.
        On small screens, where the poster alone shows, the wash runs top to bottom.
      */}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-linear-to-b from-navy-900/85 via-navy-900/90 to-navy-900 lg:bg-linear-to-r lg:from-navy-900 lg:via-navy-900/85 lg:to-navy-900/30" />
        <div className="absolute inset-0 bg-linear-to-t from-navy-900 via-transparent to-navy-900/55" />
      </div>

      <div className="shell-narrow relative grid items-start gap-12 pt-14 pb-16 lg:grid-cols-12 lg:gap-14 lg:pt-20 lg:pb-20">
        <div className="lg:col-span-7">
          <PillBadge>{hero.badge}</PillBadge>
          <h1 className="mt-7 font-display text-[38px] leading-[1.05] font-extrabold sm:text-[50px] xl:text-[58px]">
            {hero.heading}
          </h1>
          <p className="mt-7 max-w-[56ch] text-[18px] leading-relaxed text-ink-invert-muted">{hero.intro}</p>
          <ul className="mt-8 space-y-3.5 text-[16px]">
            {hero.bullets.map((bullet) => (
              <CheckBullet key={bullet}>{bullet}</CheckBullet>
            ))}
          </ul>
          {hero.stats.length > 0 ? (
            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-6 border-t border-ink-invert/15 pt-8">
              {hero.stats.map((stat) => (
                <div key={stat.label} className="flex flex-col-reverse justify-end">
                  <dt className="mt-2 text-[13.5px] text-ink-invert-muted">{stat.label}</dt>
                  <dd
                    className={`font-display text-[26px] leading-none font-extrabold sm:text-[30px] ${stat.isOutcome ? 'text-gold-ink' : ''}`}
                  >
                    <CountUp value={stat.value} suffix={stat.suffix} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div id="form" className="w-full lg:col-span-5">
          {form}
        </div>
      </div>
    </section>
  );
}

function ClientRow({ clients, duplicate }: { clients: LandingPageView['clients']; duplicate: boolean }) {
  return (
    <ul
      className={`flex shrink-0 items-center gap-14 ${duplicate ? 'ml-14' : ''}`}
      aria-hidden={duplicate ? true : undefined}
    >
      {clients.map((client) => (
        <li key={client.name} className="shrink-0">
          {client.logo ? (
            <ResponsiveImage
              src={client.logo.src}
              alt={duplicate ? '' : client.logo.alt}
              width={140}
              height={32}
              sizes="140px"
              className="h-8 w-auto opacity-40 grayscale"
            />
          ) : (
            // ink/50 keeps 3.3:1, the WCAG AA minimum for large bold text.
            <span className="font-display text-[21px] font-bold whitespace-nowrap text-ink/50">
              {client.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Client name band. Moving content that starts on its own needs a pause control
 * (WCAG 2.2.2). Hovering pauses it for pointer users. For keyboard users a checkbox
 * appears on focus and pauses it. There is no script.
 */
export function TrustBar({ label, clients }: { label: string; clients: LandingPageView['clients'] }) {
  if (clients.length === 0) return null;
  return (
    <section className="content-auto group relative overflow-hidden border-b border-hairline bg-canvas-raised py-8" aria-label={label}>
      <p className="shell-narrow mb-5 text-[13.5px]">{label}</p>
      <input id="trust-bar-pause" type="checkbox" className="peer sr-only" />
      <label
        htmlFor="trust-bar-pause"
        className="sr-only peer-focus-visible:not-sr-only peer-focus-visible:absolute peer-focus-visible:top-2 peer-focus-visible:right-6 peer-focus-visible:z-10 peer-focus-visible: peer-focus-visible:bg-navy-900 peer-focus-visible:px-3 peer-focus-visible:py-2 peer-focus-visible:text-[13px] peer-focus-visible:font-semibold peer-focus-visible:text-ink-invert peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
      >
        Pause the client logos
      </label>
      <div className="flex w-max animate-marquee px-6 group-hover:[animation-play-state:paused] peer-checked:[animation-play-state:paused]">
        <ClientRow clients={clients} duplicate={false} />
        <ClientRow clients={clients} duplicate />
      </div>
    </section>
  );
}
