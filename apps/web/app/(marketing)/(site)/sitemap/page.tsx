import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { PageHero } from '@/components/site/page-hero';
import { Section } from '@/components/site/section';
import { sitePageMetadata } from '@/lib/seo/page-metadata';
import { sitemapEntries, sitemapSections } from '@/lib/sitemap';
import { HERO_BACKDROPS } from '@/lib/hero-backdrops';

export function generateMetadata(): Promise<Metadata> {
  return sitePageMetadata({
    title: 'Sitemap',
    description:
      'Every public page on the Calwebtech website in one list, grouped by what it covers, with new pages added as soon as they are published.',
    path: SITE_ROUTES.sitemap,
  });
}

/** The human-readable sitemap (docs/03-page-specs.md), from the same sources as sitemap.xml. */
export default async function SitemapPage() {
  const sections = sitemapSections(await sitemapEntries());
  return (
    <>
      <PageHero
        backdrop={HERO_BACKDROPS.sitemap}
        crumbs={[{ name: 'Sitemap', path: SITE_ROUTES.sitemap }]}
        title="Sitemap"
        intro="Every public page on the Calwebtech website, grouped by what it covers. Services, case studies and locations are listed here as soon as they are published."
      />
      <Section tone="white" deferred={false}>
        <div className="grid gap-x-12 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <div key={section.name}>
              <h2 className="font-display text-[22px] font-bold text-ink">{section.name}</h2>
              <ul className="mt-4 space-y-1 border-t border-hairline pt-4 text-[15.5px]">
                {section.entries.map((entry) => (
                  <li key={entry.path}>
                    <a href={entry.path} className="inline-block py-1 font-medium text-gold-ink hover:text-gold-600">
                      {entry.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
