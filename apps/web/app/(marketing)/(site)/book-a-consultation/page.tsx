import { CONSULTATION_PATH } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { BookingSection } from '@/components/booking/booking-section';
import { PageHero } from '@/components/site/page-hero';
import { getBookingPage } from '@/lib/api/booking';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const view = await getBookingPage();
  if (!view) return sitePageMetadata({ title: 'Book a consultation', description: '', path: CONSULTATION_PATH });
  return sitePageMetadata({ ...view.content.seo, path: CONSULTATION_PATH });
}

/**
 * `/book-a-consultation/` (docs/06-build-plan.md, task 5.1).
 *
 * A page of its own rather than a section of the homepage: the cost calculator's result
 * links here with its answers, the header's one action points here, and a booking is a
 * task with its own steps rather than something to scroll past.
 *
 * Nothing on it is static. The times are what the database says is free at this second, so
 * the page is rendered per request and never cached — a cached slot is one somebody else
 * has already taken, shown to the next visitor as though it were free.
 */
export default async function BookAConsultationPage({ searchParams }: PageProps<'/book-a-consultation'>) {
  const [view, params] = await Promise.all([getBookingPage(), searchParams]);
  const source = typeof params.source === 'string' ? params.source : null;

  return (
    <>
      <PageHero
        crumbs={[{ name: 'Book a consultation', path: CONSULTATION_PATH }]}
        title={view?.content.title ?? 'Book a consultation'}
        answer={view?.content.answerBlock ?? ''}
        intro={view?.content.intro ?? ''}
      />

      <section className="bg-canvas py-16 lg:py-24">
        <div className="shell">
          <div className="max-w-[46rem]">
            {view ? (
              <BookingSection
                content={view.content}
                slots={view.slots}
                source={source}
                turnstileSiteKey={process.env.TURNSTILE_SITE_KEY}
              />
            ) : (
              // No API, or no consultation type set up: say so rather than show a form
              // that cannot take a booking.
              <p className="body-lg border-t border-hairline pt-8 text-ink-muted">
                Booking is not available right now. Send us a message and we will find a time by email.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
