import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { CtaBand } from '@/components/site/bands';
import { PageHero } from '@/components/site/page-hero';
import { TopicFaqSection } from '@/components/static/faq';
import { ProcessAfterLaunch, ProcessPoints, ProcessStages } from '@/components/static/process';
import { getStaticProcess } from '@/lib/api/static';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getStaticProcess();
  return sitePageMetadata({ ...content.seo, path: SITE_ROUTES.process });
}

/**
 * /process/ (docs/03-page-specs.md): every `ProcessStep` in full, with its timing, what the
 * client gets and what we need, then what keeps the dates, what slows a project, what
 * follows launch and the process questions from `Faq`. Copy is the `static.process` setting.
 */
export default async function ProcessPage() {
  const { content, steps, faqs } = await getStaticProcess();
  return (
    <>
      <PageHero
        crumbs={[{ name: 'How a project runs', path: SITE_ROUTES.process }]}
        title={content.hero.title}
        answer={content.hero.answer}
        intro={content.hero.intro}
        primaryCta={content.cta.primaryCta}
        secondaryCta={content.cta.secondaryCta}
        backdrop={content.backdrop}
      />
      <ProcessStages copy={content.steps} steps={steps} action={content.cta.primaryCta} />
      <ProcessPoints id="principles" copy={content.principles} tone="mist" />
      <ProcessPoints id="delays" copy={content.delays} tone="white" />
      <ProcessAfterLaunch copy={content.afterLaunch} />
      <TopicFaqSection heading={content.faq.heading} intro={content.faq.intro} items={faqs} group="process-faq" />
      <CtaBand
        id="process-cta"
        heading={content.cta.heading}
        body={content.cta.body}
        primaryCta={content.cta.primaryCta}
        secondaryCta={content.cta.secondaryCta}
        tone="band"
      />
    </>
  );
}
