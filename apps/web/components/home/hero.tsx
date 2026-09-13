import type { HomePageContent, HomePageView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { CountUp } from '../motion/count-up';
import { PillBadge, Stars } from '../ui/primitives';
import { BackgroundMedia } from './background-media';

function StatsStrip({ statistics }: { statistics: HomePageView['statistics'] }) {
  return (
    <div className="relative border-t border-white/12">
      <div className="shell">
        <dl className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-white/12">
          {statistics.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse py-7 lg:px-10 lg:py-8 lg:first:pl-0">
              <dt className="mt-2 text-[14px] text-white/60">{stat.label}</dt>
              <dd className="font-display text-[34px] leading-none font-extrabold text-white">
                {/^\d+$/.test(stat.value) ? (
                  <CountUp value={Number(stat.value)} suffix={stat.suffix} />
                ) : (
                  `${stat.value}${stat.suffix}`
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function HomeHero({
  hero,
  reviews,
  awards,
  statistics,
  form,
}: {
  hero: HomePageContent['hero'];
  reviews: HomePageView['reviews'];
  awards: HomePageView['awards'];
  statistics: HomePageView['statistics'];
  form: ReactNode;
}) {
  const award = awards[0];
  return (
    <section className="relative overflow-hidden bg-ink text-white">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <BackgroundMedia background={hero.background} posterClassName="opacity-[.30]" priority />
        <div className="absolute inset-0 bg-linear-to-r from-ink via-ink/95 to-ink/70" />
        <div className="absolute inset-0 bg-linear-to-t from-ink via-transparent to-ink/60" />
        <div className="glow-blue absolute inset-0" />
        <div className="glow-teal absolute inset-0" />
        <div className="grid-lines-light absolute inset-0" />
      </div>

      <div className="shell relative grid items-center gap-12 pt-14 pb-14 lg:grid-cols-12 lg:gap-14 lg:pt-20 lg:pb-16">
        <div className="lg:col-span-7">
          {hero.eyebrow ? <PillBadge>{hero.eyebrow}</PillBadge> : null}

          <h1 className="mt-7 font-display text-[40px] leading-[1.04] font-extrabold sm:text-[54px] xl:text-[62px]">
            {hero.heading}{' '}
            {hero.headingEmphasis ? (
              <span className="relative inline-block">
                {hero.headingEmphasis}
                <span
                  className="absolute -bottom-1 left-0 h-[6px] w-full rounded-full bg-linear-to-r from-primary to-primary/40"
                  aria-hidden="true"
                />
              </span>
            ) : null}
          </h1>

          <p className="mt-7 max-w-[52ch] text-[18px] leading-relaxed text-white/75">{hero.intro}</p>

          {reviews.averageRating !== null || award ? (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {reviews.averageRating !== null ? (
                <p className="glass inline-flex items-center gap-2.5 rounded-xl px-4 py-3">
                  <Stars rating={reviews.averageRating} className="text-[14px]" announce={false} />
                  <span className="text-[13.5px] leading-tight">
                    <b className="block text-white">{reviews.averageRating.toFixed(1)} average</b>
                    <span className="text-white/60">{reviews.totalReviews} reviews</span>
                  </span>
                </p>
              ) : null}
              {award ? (
                <a href="#awards" className="glass inline-flex items-center rounded-xl px-4 py-3 hover:bg-white/15">
                  <span className="text-[13.5px] leading-tight">
                    <b className="block text-white">{award.name}</b>
                    {award.detail ? <span className="text-white/60">{award.detail}</span> : null}
                  </span>
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={hero.primaryCta.href}
              className="glass inline-flex items-center rounded-xl px-6 py-3.5 text-[15.5px] font-semibold text-white hover:bg-white/15"
            >
              {hero.primaryCta.label}
            </a>
            {hero.secondaryCta ? (
              <a
                href={hero.secondaryCta.href}
                className="inline-flex items-center rounded-xl px-6 py-3.5 text-[15.5px] font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                {hero.secondaryCta.label}
              </a>
            ) : null}
          </div>
        </div>

        <div id="quote" className="w-full lg:col-span-5">
          {form}
        </div>
      </div>

      {statistics.length > 0 ? <StatsStrip statistics={statistics} /> : null}
    </section>
  );
}
