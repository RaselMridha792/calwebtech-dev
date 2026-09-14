import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { IndustriesIndex } from '@/components/industries/industry-page';
import { getIndustriesIndex } from '@/lib/api/industries';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getIndustriesIndex();
  return sitePageMetadata({ ...content.seo, path: SITE_ROUTES.industries });
}

/** `/industries/`: every published industry, with copy from the `industries.index` setting. */
export default async function IndustriesPage() {
  return <IndustriesIndex view={await getIndustriesIndex()} />;
}
