import type { HomePageContent, HomePageView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { CountUp } from '../motion/count-up';
import { BackgroundVideo } from '../ui/background-video';
import { BackdropImage } from '../ui/brand';
import { PillBadge, Stars } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';
import { asPhrase } from './parts';

type Home = HomePageView;
type Hero = HomePageContent['hero'];

function StatsStrip({ statistics }: { statistics: Home['statistics'] }) {
  return (
    <div className="relative border-t border-white/12">
      <div className="shell">
        <dl className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-white/12">
          {statistics.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse py-7 lg:px-10 lg:py-8 lg:first:pl-0">
              <dt className="mt-2 text-[14px] text-white/60">{stat.label}</dt>
              <dd
                className={`font-display text-[34px] leading-none font-extrabold ${stat.outcome ? 'text-result' : 'text-white'}`}
              >
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

/** "A, B and C". */
function listOf(items: string[]): string {
  const last = items.at(-1);
  if (last === undefined) return '';
  return items.length === 1 ? last : `${items.slice(0, -1).join(', ')} and ${last}`;
}

/** Decorative growth bars on the result card: flat before launch, rising after it. */
const BARS = [
  { height: 22, className: 'rounded-full bg-mist' },
  { height: 30, className: 'rounded-full bg-mist' },
  { height: 27, className: 'rounded-full bg-mist' },
  { height: 46, className: 'rounded-full bg-mist' },
  { height: 62, className: 'rounded-full bg-result/25' },
  { height: 80, className: 'rounded-full bg-result/55' },
  { height: 100, className: 'rounded-full bg-result' },
];

/** Photographs with the first featured project's headline figure, as approved. */
function HeroMedia({
  media,
  featured,
}: {
  media: NonNullable<Hero['media']>;
  featured: Home['projects'][number] | null;
}) {
  const metric = featured?.metrics[0];
  return (
    <div className="relative lg:col-span-6">
      <div className="relative aspect-5/4 overflow-hidden rounded-2xl shadow-form ring-1 ring-white/15">
        <ResponsiveImage
          src={media.image.src}
          alt={media.image.alt}
          fill
          sizes="(min-width: 1440px) 640px, (min-width: 1024px) 45vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-ink/70 via-transparent to-transparent" aria-hidden="true" />
      </div>

      {media.secondaryImage ? (
        <div className="absolute -top-8 -right-3 hidden w-47 overflow-hidden rounded-xl shadow-form ring-1 ring-white/20 sm:block lg:-right-8">
          <ResponsiveImage
            src={media.secondaryImage.src}
            alt={media.secondaryImage.alt}
            width={188}
            height={132}
            sizes="188px"
            className="h-33 w-full object-cover"
          />
        </div>
      ) : null}

      {featured && metric ? (
        <div className="absolute -bottom-8 -left-2 w-65.5 rounded-2xl border border-line bg-white p-5 text-ink shadow-form sm:left-4">
          <p className="text-[13px] text-body">{`${featured.clientName}, ${asPhrase(metric.label)}`}</p>
          <p className="mt-1.5 font-display text-[36px] leading-none font-extrabold text-result">{metric.value}</p>
          <div className="mt-4 flex h-11 items-end gap-1.5" aria-hidden="true">
            {BARS.map((bar) => (
              <span key={bar.height} className={`flex-1 ${bar.className}`} style={{ height: `${String(bar.height)}%` }} />
            ))}
          </div>
          {media.metricCaption ? (
            <p className="mt-3 border-t border-line pt-3 text-[12px] text-body">{media.metricCaption}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function HomeHero({
  hero,
  reviews,
  statistics,
  featured,
  form,
}: {
  hero: Hero;
  reviews: Home['reviews'];
  statistics: Home['statistics'];
  /** The first featured project; its first figure sits on the media card. */
  featured: Home['projects'][number] | null;
  /** The quote form, shown when the hero has no media. */
  form: ReactNode;
}) {
  const { media } = hero;
  const platforms = reviews.sources.slice(0, 3).map((source) => source.platform);
  return (
    <section className="relative overflow-hidden bg-ink text-white">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <BackdropImage image={hero.background.poster} className="kenburns opacity-[.28]" priority />
      </div>
      {hero.background.videoUrl ? (
        <BackgroundVideo src={hero.background.videoUrl} className="opacity-100" controlClassName="top-5 right-5" />
      ) : null}
      <div className="absolute inset-0" aria-hidden="true">
        <div className={`absolute inset-0 bg-linear-to-r from-ink via-ink/95 ${media ? 'to-ink/55' : 'to-ink/70'}`} />
        <div className="absolute inset-0 bg-linear-to-t from-ink via-transparent to-ink/60" />
        <div className="glow-blue absolute inset-0" />
        <div className="glow-teal absolute inset-0" />
        <div className="grid-lines-light absolute inset-0" />
      </div>

      <div
        className={`shell relative grid items-center lg:grid-cols-12 ${media ? 'gap-14 pt-16 pb-14 lg:gap-16 lg:pt-24 lg:pb-20' : 'gap-12 pt-14 pb-14 lg:gap-14 lg:pt-20 lg:pb-16'}`}
      >
        <div className={media ? 'lg:col-span-6' : 'lg:col-span-7'}>
          {hero.eyebrow ? (
            <PillBadge>
              {hero.eyebrow}
              {hero.eyebrowDetail ? (
                <>
                  <span className="h-3.5 w-px bg-white/25" aria-hidden="true" />
                  <span className="text-white/70">{hero.eyebrowDetail}</span>
                </>
              ) : null}
            </PillBadge>
          ) : null}

          <h1 className="mt-7 font-display text-[42px] leading-[1.03] font-extrabold sm:text-[56px] xl:text-[66px]">
            {hero.heading}{' '}
            {hero.headingEmphasis ? (
              <span className="relative inline-block">
                {hero.headingEmphasis}
                <span
                  className="absolute -bottom-1 left-0 h-1.5 w-full rounded-full bg-linear-to-r from-primary to-primary/40"
                  aria-hidden="true"
                />
              </span>
            ) : null}
          </h1>

          <p className="mt-8 max-w-[54ch] text-[18px] leading-relaxed text-white/75">{hero.intro}</p>

          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href={hero.primaryCta.href}
              className={
                media
                  ? 'inline-flex h-14 items-center rounded-xl bg-primary px-7 text-[16px] font-semibold text-white shadow-cta hover:bg-primaryd'
                  : 'glass inline-flex items-center rounded-xl px-6 py-3.5 text-[15.5px] font-semibold text-white hover:bg-white/15'
              }
            >
              {hero.primaryCta.label}
            </a>
            {hero.secondaryCta ? (
              <a
                href={hero.secondaryCta.href}
                className={
                  media
                    ? 'glass inline-flex h-14 items-center rounded-xl px-7 text-[16px] font-semibold text-white hover:bg-white/15'
                    : 'inline-flex items-center rounded-xl px-6 py-3.5 text-[15.5px] font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white'
                }
              >
                {hero.secondaryCta.label}
              </a>
            ) : null}
          </div>

          {reviews.averageRating !== null ? (
            <p className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-white/65">
              <Stars rating={reviews.averageRating} className="text-[15px]" announce={false} />
              <span>
                <span className="sr-only">Average rating </span>
                <b className="text-white">{reviews.averageRating.toFixed(1)}</b>{' '}
                {platforms.length > 0
                  ? `across ${listOf(platforms)}`
                  : `from ${String(reviews.totalReviews)} reviews`}
              </span>
            </p>
          ) : null}
        </div>

        {media ? (
          <HeroMedia media={media} featured={featured} />
        ) : (
          <div id="quote" className="w-full lg:col-span-5">
            {form}
          </div>
        )}
      </div>

      {statistics.length > 0 ? <StatsStrip statistics={statistics} /> : null}
    </section>
  );
}
