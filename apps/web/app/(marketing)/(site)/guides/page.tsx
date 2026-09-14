import { GUIDES_ROUTE } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { GuidesIndex } from '@/components/guides-glossary/guides-index';
import { getGuidesIndex } from '@/lib/api/guides-glossary';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getGuidesIndex();
  return sitePageMetadata({ ...content.seo, path: GUIDES_ROUTE });
}

/** `/guides/`: every published guide, with copy from the `guides.index` setting. */
export default async function GuidesPage() {
  return <GuidesIndex view={await getGuidesIndex()} />;
}
