import type { HomePageContent, HomePageView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { CountUp } from '../motion/count-up';
import { BackgroundVideo } from '../ui/background-video';
import { BackdropImage } from '../ui/brand';
import { Stars } from '../ui/primitives';

type Home = HomePageView;
type Hero = HomePageContent['hero'];

/**
 * The proof band under the hero: figures in champagne on the dark ground, opened by a slab
 * rule. The numerals are the largest use of gold on the page, which is why nothing else in
 * the band carries it. Cells are divided by a rule and take no ground of their own — they
 * are not cards.
 */
function StatsStrip({ statistics }: { statistics: Home['statistics'] }) {
  return (
    <div className="relative border-t-[6px] border-gold-500">
      <div className="shell">
        <dl className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-ink-invert/15">
          {statistics.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse py-7 lg:px-10 lg:py-8 lg:first:pl-0">
              <dt className="body-sm mt-2 text-ink-invert-muted">{stat.label}</dt>
              <dd className="display-md text-gold-500">
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

/**
 * The opening section: the photograph full width under a single strong scrim, with the
 * type over it.
 *
 * One scrim across the whole image rather than a gradient at one edge — a bottom-only fade
 * leaves the headline's first line sitting on raw photography, which is where contrast
 * fails. With the full scrim the inverted ink holds well above the 7.8:1 the brand asks for.
 */
export function HomeHero({
  hero,
  reviews,
  statistics,
  form,
}: {
  hero: Hero;
  reviews: Home['reviews'];
  statistics: Home['statistics'];
  /**
   * The quote form, at `#quote`. The photographs that used to take this column are gone,
   * but the form is not decoration: the page's own calls to action link to this anchor,
   * and `hero.media` was only ever allowed to replace it, never to remove it.
   */
  form: ReactNode;
}) {
  const platforms = reviews.sources.slice(0, 3).map((source) => source.platform);
  return (
    <section data-hero="dark" className="relative overflow-hidden bg-navy-900 text-ink-invert">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <BackdropImage image={hero.background.poster} className="kenburns opacity-100" priority />
      </div>
      {hero.background.videoUrl ? (
        <BackgroundVideo src={hero.background.videoUrl} className="opacity-100" controlClassName="top-5 right-5" />
      ) : null}
      <div className="absolute inset-0 bg-scrim-strong" aria-hidden="true" />

      <div className="shell relative grid items-center gap-12 pt-32 pb-14 lg:grid-cols-12 lg:gap-16 lg:pt-40 lg:pb-24">
        <div className="lg:col-span-7">
          {hero.eyebrow ? (
            <div className="border-t border-hairline-gold pt-4">
              <p className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1 text-gold-500">
                {hero.eyebrow}
                {hero.eyebrowDetail ? (
                  <>
                    <span className="h-3 w-px bg-hairline-gold" aria-hidden="true" />
                    <span className="text-ink-invert-muted">{hero.eyebrowDetail}</span>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}

          <h1 className="display-xl mt-7 max-w-[17ch] text-balance">
            {hero.heading} {hero.headingEmphasis ? <span className="text-gold-500">{hero.headingEmphasis}</span> : null}
          </h1>

          <p className="body-lg mt-8 max-w-[56ch] text-ink-invert-muted">{hero.intro}</p>

          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href={hero.primaryCta.href}
              className="button-label inline-flex min-h-12 items-center bg-gold-500 px-6 py-4 text-on-gold transition-colors duration-150 hover:bg-gold-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-invert"
            >
              {hero.primaryCta.label}
            </a>
            {hero.secondaryCta ? (
              <a
                href={hero.secondaryCta.href}
                className="button-label inline-flex min-h-12 items-center border border-ink-invert/40 px-6 py-4 text-ink-invert transition-colors duration-150 hover:border-ink-invert focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-invert"
              >
                {hero.secondaryCta.label}
              </a>
            ) : null}
          </div>

          {reviews.averageRating !== null ? (
            <p className="body-sm mt-9 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-invert-muted">
              <Stars rating={reviews.averageRating} className="text-[15px]" announce={false} />
              <span>
                <span className="sr-only">Average rating </span>
                <b className="text-ink-invert">{reviews.averageRating.toFixed(1)}</b>{' '}
                {platforms.length > 0
                  ? `across ${listOf(platforms)}`
                  : `from ${String(reviews.totalReviews)} reviews`}
              </span>
            </p>
          ) : null}
        </div>

        <div id="quote" className="w-full lg:col-span-5">
          {form}
        </div>
      </div>

      {statistics.length > 0 ? <StatsStrip statistics={statistics} /> : null}
    </section>
  );
}
