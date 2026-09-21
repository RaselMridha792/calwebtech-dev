import type { SiteChromeView } from '@calwebtech/shared';
import { ChevronIcon } from '../ui/icons';
import { Stars } from '../ui/primitives';

type Reviews = SiteChromeView['reviews'];

const counted = (count: number, noun: string) => `${String(count)} ${noun}${count === 1 ? '' : 's'}`;

/** Where the rating comes from. Renders only when review sources are published. */
function ReviewBadge({ reviews, noun }: { reviews: Reviews; noun: string }) {
  if (reviews.averageRating === null) return null;
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 hover:text-ink-invert [&::-webkit-details-marker]:hidden">
        <Stars rating={reviews.averageRating} announce={false} />
        <span className="font-semibold text-ink-invert">{reviews.averageRating.toFixed(1)}</span>
        <span>{`from ${String(reviews.totalReviews)} ${noun}`}</span>
        <ChevronIcon className="h-2.5 w-2.5 opacity-60" />
      </summary>
      <div className="absolute top-9 right-0 z-50 w-72 border border-hairline bg-canvas-raised p-4 text-ink shadow-2xl">
        <p className="mb-3 font-display text-sm font-bold">Where our rating comes from</p>
        <ul className="space-y-2.5 text-[13px]">
          {reviews.sources.map((source) => (
            <li key={source.platform} className="flex items-center justify-between">
              <span className="text-ink-muted">{source.platform}</span>
              <span>
                <b>{source.rating.toFixed(1)}</b>
                {source.reviewCount !== null ? (
                  <span className="text-ink-muted">{` · ${counted(source.reviewCount, 'review')}`}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {reviews.npsScore !== null ? (
          <p className="mt-3 border-t border-hairline pt-3 text-[12px] text-ink-muted">
            Net Promoter Score <b className="text-ink">{reviews.npsScore.toFixed(1)}</b>
            {reviews.npsProjectCount !== null
              ? `, measured across ${counted(reviews.npsProjectCount, 'client project')}.`
              : null}
          </p>
        ) : null}
      </div>
    </details>
  );
}

/** Phone, email, service area and the rating badge above the header, from the large breakpoint. */
export function UtilityBar({ chrome }: { chrome: SiteChromeView }) {
  const { contact, reviews, utilityBar } = chrome;
  return (
    <div className="hidden bg-navy-900 text-[13px] text-ink-invert-muted lg:block">
      <div className="shell flex h-11 items-center justify-between">
        <div className="flex items-center gap-6">
          <a href={`tel:${contact.phoneE164}`} className="hover:text-ink-invert">
            {contact.phone}
          </a>
          <span className="text-ink-invert-muted" aria-hidden="true">
            |
          </span>
          <a href={`mailto:${contact.email}`} className="hover:text-ink-invert">
            {contact.email}
          </a>
          {utilityBar.serviceArea ? (
            <>
              <span className="text-ink-invert-muted" aria-hidden="true">
                |
              </span>
              <span>{utilityBar.serviceArea}</span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-5">
          <ReviewBadge reviews={reviews} noun={utilityBar.reviewNoun} />
          {utilityBar.links.map((link) => (
            <a key={`${link.label}${link.href}`} href={link.href} className="hover:text-ink-invert">
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
