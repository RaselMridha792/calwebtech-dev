import { guidePath } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuideDetail } from '@/components/guides-glossary/guide-page';
import { getGuidePage } from '@/lib/api/guides-glossary';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata({ params }: PageProps<'/guides/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const page = await getGuidePage(slug);
  if (!page) return { robots: { index: false, follow: false } };
  return sitePageMetadata({ ...page.seo, path: guidePath(page.slug) });
}

/**
 * `/guides/<slug>/`: one published guide, or the site's 404 for any other slug. The summary
 * is ungated; only the download sits behind the email gate, which posts a RESOURCE lead.
 */
export default async function GuidePage({ params }: PageProps<'/guides/[slug]'>) {
  const { slug } = await params;
  const page = await getGuidePage(slug);
  if (!page) notFound();
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY;
  return <GuideDetail page={page} {...(turnstileSiteKey ? { turnstileSiteKey } : {})} />;
}
