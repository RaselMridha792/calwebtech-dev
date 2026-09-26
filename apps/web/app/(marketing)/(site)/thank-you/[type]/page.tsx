import { thankYouPath } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHasOwnForm } from '@/components/site/conversion-band';
import { PageHero } from '@/components/site/page-hero';
import { ThankYouDetails, ThankYouResponse, ThankYouSecondary } from '@/components/static/thank-you';
import { getStaticThankYou } from '@/lib/api/static';
import { sitePageMetadata } from '@/lib/seo/page-metadata';
import { HERO_BACKDROPS } from '@/lib/hero-backdrops';

export async function generateMetadata({ params }: PageProps<'/thank-you/[type]'>): Promise<Metadata> {
  const { type } = await params;
  const page = await getStaticThankYou(type);
  if (!page) return { robots: { index: false, follow: false } };
  // A confirmation is never a search result.
  return sitePageMetadata({ ...page.seo, path: thankYouPath(page.type), noindex: true });
}

/**
 * /thank-you/<type>/ (docs/03-page-specs.md): where a form lands once its lead is stored,
 * for contact, project, audit, calculator, booking, resource and careers. It confirms what
 * was sent, when to expect a reply and offers a secondary action. Copy is the
 * `static.thank-you` setting; an unknown type answers 404.
 */
export default async function ThankYouPage({ params, searchParams }: PageProps<'/thank-you/[type]'>) {
  const [{ type }, query] = await Promise.all([params, searchParams]);
  const page = await getStaticThankYou(type);
  if (!page) notFound();
  const booked = page.type === 'booking' ? bookedTime(query.at, query.tz) : null;
  return (
    <>
      <PageHero
        backdrop={HERO_BACKDROPS.thankYou}
        crumbs={[{ name: page.eyebrow, path: thankYouPath(page.type) }]}
        eyebrow={page.eyebrow}
        title={page.title}
        intro={page.intro}
        aside={<ThankYouResponse page={page} />}
      >
        {booked ? (
          <p className="mt-8 border-t border-hairline-gold pt-5">
            <span className="eyebrow block text-gold-500">Your call</span>
            <span className="heading-lg mt-2 block text-ink-invert">{booked.when}</span>
            <span className="body-sm mt-1 block text-ink-invert-muted">{`Shown in ${booked.zone}`}</span>
          </p>
        ) : null}
      </PageHero>
      <PageHasOwnForm />
      <ThankYouDetails page={page} />
      <ThankYouSecondary page={page} />
    </>
  );
}

/**
 * The time a booking was made for, repeated back from the address the booking form sent
 * the visitor to. Anything that is not a real instant or a zone the runtime knows is
 * ignored rather than shown wrong — the page reads perfectly well without it.
 */
function bookedTime(at: string | string[] | undefined, tz: string | string[] | undefined) {
  if (typeof at !== 'string' || typeof tz !== 'string') return null;
  const instant = new Date(at);
  if (Number.isNaN(instant.getTime())) return null;
  try {
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz });
    const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
    return { when: `${day.format(instant)} at ${time.format(instant)}`, zone: tz.replace(/_/g, ' ') };
  } catch {
    return null;
  }
}
