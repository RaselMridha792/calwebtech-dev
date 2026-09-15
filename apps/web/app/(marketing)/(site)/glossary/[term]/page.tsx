import { glossaryTermPath } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GlossaryTermPage } from '@/components/guides-glossary/glossary-term';
import { getGlossaryTerm } from '@/lib/api/guides-glossary';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata({ params }: PageProps<'/glossary/[term]'>): Promise<Metadata> {
  const { term } = await params;
  const page = await getGlossaryTerm(term);
  if (!page) return { robots: { index: false, follow: false } };
  return sitePageMetadata({ ...page.seo, path: glossaryTermPath(page.slug) });
}

/** `/glossary/<term>/`: one published term, or the site's 404 for any other slug. */
export default async function GlossaryTermRoute({ params }: PageProps<'/glossary/[term]'>) {
  const { term } = await params;
  const page = await getGlossaryTerm(term);
  if (!page) notFound();
  return <GlossaryTermPage page={page} />;
}
