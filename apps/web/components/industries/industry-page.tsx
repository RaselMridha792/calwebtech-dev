import { SITE_ROUTES, industryPath, type IndustriesIndexView, type IndustryDetailView } from '@calwebtech/shared';
import { JsonLd } from '../seo/json-ld';
import { FaqSection } from '../site/faq-section';
import { PageHero } from '../site/page-hero';
import { IndustriesApproach, IndustriesList } from './industries-index';
import {
  IndustryCaseStudies,
  IndustryCompliance,
  IndustryHighlights,
  IndustryIntegrations,
  IndustryPainPoints,
  IndustryResults,
  IndustryServices,
} from './industry-sections';
import { industryServiceJsonLd } from './json-ld';
import { industrySectionTones, type IndustrySectionTone } from './section-tones';

const light = (tone: IndustrySectionTone | undefined): 'white' | 'tint' => (tone === 'tint' ? 'tint' : 'white');

/** The content of `/industries/`, between the site layout's header and closing band. */
export function IndustriesIndex({ view }: { view: IndustriesIndexView }) {
  const { content, industries } = view;
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

/**
 * The content of an industry page (docs/03-page-specs.md, Industry detail): the answer block
 * under the H1, then pain points, matched services, compliance notes, case studies, the
 * sector's results with a client quote, integrations and FAQs. The site layout closes it
 * with the conversion band. Sections without copy or records are left out.
 */
export function IndustryDetail({ page }: { page: IndustryDetailView }) {
  const tones = industrySectionTones(page);
  return (
    <>
      <PageHero
        crumbs={[
          { name: 'Industries', path: SITE_ROUTES.industries },
          { name: page.name, path: industryPath(page.slug) },
        ]}
        title={page.title}
        answer={page.answerBlock}
        intro={page.hero.intro}
        primaryCta={page.hero.primaryCta}
        secondaryCta={page.hero.secondaryCta}
        backdrop={page.hero.backdrop}
        aside={page.hero.highlights.length > 0 ? <IndustryHighlights hero={page.hero} /> : undefined}
      />
      {page.painPoints ? <IndustryPainPoints section={page.painPoints} tone={light(tones.painPoints)} /> : null}
      {page.services ? <IndustryServices section={page.services} tone={light(tones.services)} /> : null}
      {page.compliance ? <IndustryCompliance section={page.compliance} tone={light(tones.compliance)} /> : null}
      {page.caseStudies ? (
        <IndustryCaseStudies section={page.caseStudies} tone={light(tones.caseStudies)} />
      ) : null}
      {page.results ? <IndustryResults section={page.results} backdrop={page.hero.backdrop} /> : null}
      {page.integrations ? (
        <IndustryIntegrations section={page.integrations} tone={light(tones.integrations)} />
      ) : null}
      {page.faq ? (
        <FaqSection
          id="industry-faq"
          heading={page.faq.heading}
          intro={page.faq.intro}
          items={page.faq.items}
          group="industry-faq"
          tone={light(tones.faq)}
        />
      ) : null}
      <JsonLd data={industryServiceJsonLd(page)} />
    </>
  );
}
