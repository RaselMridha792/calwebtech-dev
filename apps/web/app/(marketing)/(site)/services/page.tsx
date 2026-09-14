import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { ServiceGroups } from '@/components/services/index-sections';
import { PageHero } from '@/components/site/page-hero';
import { getServicesIndex } from '@/lib/api/services';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getServicesIndex();
  return sitePageMetadata({ ...content.seo, path: SITE_ROUTES.services });
}

/** `/services/`: every published service, grouped by category (docs/03-page-specs.md). */
export default async function ServicesIndexPage() {
  const view = await getServicesIndex();
  const { content } = view;
  return (
    <>
      <PageHero
        crumbs={[{ name: 'Services', path: SITE_ROUTES.services }]}
        title={content.title}
        answer={content.answerBlock}
        intro={content.intro}
      />
      <ServiceGroups view={view} />
    </>
  );
}
