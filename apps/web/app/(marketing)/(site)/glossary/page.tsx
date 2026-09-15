import { GLOSSARY_ROUTE } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { GlossaryIndex } from '@/components/guides-glossary/glossary-index';
import { getGlossaryIndex } from '@/lib/api/guides-glossary';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getGlossaryIndex();
  return sitePageMetadata({ ...content.seo, path: GLOSSARY_ROUTE });
}

/** `/glossary/`: every published term A to Z, with copy from the `glossary.index` setting. */
export default async function GlossaryPage() {
  return <GlossaryIndex view={await getGlossaryIndex()} />;
}
