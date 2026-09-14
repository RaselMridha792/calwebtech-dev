import type { CompanyHero as CompanyHeroCopy } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { PageHero } from '@/components/site/page-hero';
import type { Crumb } from '@/lib/seo/json-ld';

/**
 * The dark hero every company page opens with: breadcrumbs, the H1, the answer block, then
 * the introduction and calls to action over the page's backdrop.
 */
export function CompanyHero({ hero, crumb, aside }: { hero: CompanyHeroCopy; crumb: Crumb; aside?: ReactNode }) {
  return (
    <PageHero
      crumbs={[crumb]}
      eyebrow={hero.eyebrow}
      title={hero.title}
      answer={hero.answerBlock}
      intro={hero.intro}
      primaryCta={hero.primaryCta}
      secondaryCta={hero.secondaryCta}
      backdrop={hero.backdrop}
      aside={aside}
    />
  );
}

/**
 * Stands in for a list while no records are published. The data attribute lets end-to-end
 * tests find the empty state of each list.
 */
export function CompanyEmpty({ list, children }: { list: string; children: ReactNode }) {
  return <div data-company-empty={list}>{children}</div>;
}
