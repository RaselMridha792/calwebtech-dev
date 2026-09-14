import { thankYouPath } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHasOwnForm } from '@/components/site/conversion-band';
import { PageHero } from '@/components/site/page-hero';
import { ThankYouDetails, ThankYouResponse, ThankYouSecondary } from '@/components/static/thank-you';
import { getStaticThankYou } from '@/lib/api/static';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

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
export default async function ThankYouPage({ params }: PageProps<'/thank-you/[type]'>) {
  const { type } = await params;
  const page = await getStaticThankYou(type);
  if (!page) notFound();
  return (
    <>
      <PageHasOwnForm />
      <PageHero
        ground="light"
        crumbs={[{ name: page.eyebrow, path: thankYouPath(page.type) }]}
        eyebrow={page.eyebrow}
        title={page.title}
        intro={page.intro}
        aside={<ThankYouResponse page={page} />}
      />
      <ThankYouDetails page={page} />
      <ThankYouSecondary page={page} />
    </>
  );
}
