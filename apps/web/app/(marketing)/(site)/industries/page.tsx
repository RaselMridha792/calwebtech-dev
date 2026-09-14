import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { IndustriesApproach, IndustriesList } from '@/components/industries/industries-index';
import { PageHero } from '@/components/site/page-hero';
import { getIndustriesIndex } from '@/lib/api/industries';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getIndustriesIndex();
  return sitePageMetadata({ ...content.seo, path: SITE_ROUTES.industries });
}

/** `/industries/`: every published industry, with copy from the `industries.index` setting. */
export default async function IndustriesPage() {
  const { content, industries } = await getIndustriesIndex();
  return (
    <>
      <PageHero
        crumbs={[{ name: 'Industries', path: SITE_ROUTES.industries }]}
        title={content.title}
        answer={content.answerBlock}
        intro={content.intro}
        primaryCta={content.primaryCta}
        backdrop={content.backdrop}
      />
      <IndustriesList list={content.list} notListed={content.notListed} industries={industries} />
      <IndustriesApproach approach={content.approach} backdrop={content.backdrop} />
    </>
  );
}
