import { caseStudyPath, type CompanyReviewSummary, type CompanyTestimonial } from '@calwebtech/shared';
import { Stars, reveal } from '@/components/ui/primitives';
import { ResponsiveImage } from '@/components/ui/responsive-image';
import { byline } from '@/lib/text';

const counted = (count: number, noun: string) => `${String(count)} ${noun}${count === 1 ? '' : 's'}`;

const monthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The weighted rating beside the testimonials hero, on the dark ground. Nothing without reviews. */
export function RatingCard({ reviews }: { reviews: CompanyReviewSummary }) {
  if (reviews.averageRating === null) return null;
  return (
    <div data-rating-card="" className="glass max-w-md rounded-2xl p-7 lg:ml-auto">
      <p className="text-[14px] text-white/75">Average rating across review platforms</p>
      <p className="mt-3 flex items-baseline gap-3">
        <span className="font-display text-[56px] leading-none font-extrabold">{reviews.averageRating.toFixed(1)}</span>
        <span className="text-[15px] text-white/75">out of 5</span>
      </p>
      <Stars rating={reviews.averageRating} announce={false} className="mt-2 block text-[20px]" />
      <p className="mt-4 text-[15px] text-white/85">
        {`From ${counted(reviews.totalReviews, 'review')} on ${counted(reviews.sources.length, 'platform')}.`}
      </p>
      {reviews.npsScore !== null ? (
        <p className="mt-4 border-t border-white/15 pt-4 text-[14px] text-white/75">
          {`Net Promoter Score ${reviews.npsScore.toFixed(1)}`}
          {reviews.npsProjectCount !== null ? `, measured across ${counted(reviews.npsProjectCount, 'client project')}.` : '.'}
        </p>
      ) : null}
    </div>
  );
}

/** Each platform's rating and review count, most reviews first, with a link to the profile when known. */
export function RatingBreakdown({ reviews, method }: { reviews: CompanyReviewSummary; method: string }) {
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <div className="overflow-x-auto lg:col-span-7">
        <table data-company-list="ratings" className="w-full border-collapse text-left text-[15.5px]">
          <caption className="sr-only">Ratings by review platform</caption>
          <thead>
            <tr className="border-b border-line text-[13.5px] text-body">
              <th scope="col" className="py-3 pr-4 font-semibold">
                Platform
              </th>
              <th scope="col" className="py-3 pr-4 font-semibold">
                Rating
              </th>
              <th scope="col" className="py-3 text-right font-semibold">
                Reviews
              </th>
            </tr>
          </thead>
          <tbody>
            {reviews.sources.map((source) => (
              <tr key={source.platform} className="border-b border-line bg-white/60">
                <th scope="row" className="py-4 pr-4 font-display font-bold text-ink">
                  {source.profileUrl ? (
                    <a href={source.profileUrl} rel="noopener" className="inline-block py-1 text-primary hover:text-primaryd">
                      {source.platform}
                      <span className="sr-only"> profile</span>
                    </a>
                  ) : (
                    source.platform
                  )}
                </th>
                <td className="py-4 pr-4 whitespace-nowrap">
                  <b className="text-ink">{source.rating.toFixed(1)}</b>
                  <Stars rating={source.rating} announce={false} className="ml-2 text-[14px]" />
                </td>
                <td className="py-4 text-right text-ink">{source.reviewCount}</td>
              </tr>
            ))}
          </tbody>
          {reviews.averageRating !== null ? (
            <tfoot>
              <tr className="text-ink">
                <th scope="row" className="py-4 pr-4 font-display font-bold">
                  Weighted average
                </th>
                <td className="py-4 pr-4 font-bold">{reviews.averageRating.toFixed(1)}</td>
                <td className="py-4 text-right font-bold">{reviews.totalReviews}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <div className="lg:col-span-5" {...reveal(1)}>
        <p className="text-[16px] leading-relaxed">{method}</p>
        {reviews.npsScore !== null ? (
          <p className="mt-5 text-[15px]">
            {'Net Promoter Score '}
            <b className="text-ink">{reviews.npsScore.toFixed(1)}</b>
            {reviews.npsProjectCount !== null ? `, measured across ${counted(reviews.npsProjectCount, 'client project')}.` : '.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Consented client quotes, featured first, each linking to its published case study. */
export function TestimonialList({
  testimonials,
  caseStudyLabel,
}: {
  testimonials: readonly CompanyTestimonial[];
  caseStudyLabel: string;
}) {
  return (
    <ul data-company-list="testimonials" className="grid gap-6 md:grid-cols-2">
      {testimonials.map((testimonial, index) => {
        const who = byline(testimonial.role, testimonial.company);
        return (
          <li key={testimonial.id} data-testimonial="" {...reveal(index)}>
            <figure className="flex h-full flex-col rounded-2xl border border-line bg-white p-7 lg:p-8">
              <Stars rating={testimonial.rating} className="text-[15px]" />
              <blockquote
                className={`mt-4 flex-1 leading-relaxed text-ink ${testimonial.featured ? 'font-display text-[20px] font-semibold lg:text-[22px]' : 'text-[17px]'}`}
              >
                {`"${testimonial.quote}"`}
              </blockquote>
              <figcaption className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-4 border-t border-line pt-5">
                {testimonial.avatar ? (
                  <ResponsiveImage
                    src={testimonial.avatar.src}
                    alt=""
                    width={48}
                    height={48}
                    sizes="48px"
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : null}
                <span className="text-[14.5px]">
                  <b className="block text-ink">{testimonial.clientName}</b>
                  {who ? <span>{who}</span> : null}
                  {testimonial.source || testimonial.date ? (
                    <span className="block text-[13px]">
                      {testimonial.source ? `Via ${testimonial.source}` : null}
                      {testimonial.source && testimonial.date ? ' · ' : null}
                      {testimonial.date ? (
                        <time dateTime={testimonial.date}>{monthYear.format(new Date(testimonial.date))}</time>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                {testimonial.caseStudySlug ? (
                  <a
                    href={caseStudyPath(testimonial.caseStudySlug)}
                    className="inline-block py-1 text-[14.5px] font-semibold text-primary hover:text-primaryd sm:ml-auto"
                  >
                    {caseStudyLabel}
                    <span className="sr-only">{`: ${testimonial.company ?? testimonial.clientName}`}</span>
                  </a>
                ) : null}
              </figcaption>
            </figure>
          </li>
        );
      })}
    </ul>
  );
}
