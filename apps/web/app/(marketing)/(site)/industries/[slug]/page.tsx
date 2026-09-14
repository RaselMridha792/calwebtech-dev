import { industryPath } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { IndustryDetail } from '@/components/industries/industry-page';
import { getIndustryPage } from '@/lib/api/industries';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata({ params }: PageProps<'/industries/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const page = await getIndustryPage(slug);
  if (!page) return { robots: { index: false, follow: false } };
  return sitePageMetadata({ ...page.seo, path: industryPath(page.slug) });
}

/** `/industries/<slug>/`: one published industry, or the site's 404 for any other slug. */
export default async function IndustryPage({ params }: PageProps<'/industries/[slug]'>) {
  const { slug } = await params;
  const page = await getIndustryPage(slug);
  if (!page) notFound();
  return <IndustryDetail page={page} />;
}
