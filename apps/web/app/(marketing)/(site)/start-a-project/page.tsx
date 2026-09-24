import {
  BUDGET_BANDS,
  FORMS_PROJECT_FAQ_GROUP,
  FORMS_PROJECT_FORM_ID,
  FORMS_ROUTES,
  LEAD_PROJECT_TYPES,
  START_TIMELINES,
  staticThankYouPathForLead,
} from '@calwebtech/shared';
import type { Metadata } from 'next';
import { ProjectBriefForm } from '@/components/forms-pages/project-brief-form';
import {
  ProjectAlternatives,
  ProjectFormSection,
  ProjectWhatHappens,
  ProjectWhatWeNeed,
} from '@/components/forms-pages/project-sections';
import { PageHasOwnForm } from '@/components/site/conversion-band';
import { FaqSection } from '@/components/site/faq-section';
import { PageHero } from '@/components/site/page-hero';
import { getFormsProjectPage } from '@/lib/api/forms';
import { HERO_BACKDROPS } from '@/lib/hero-backdrops';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getFormsProjectPage();
  return sitePageMetadata({ ...content.seo, path: FORMS_ROUTES.startProject });
}

/**
 * `/start-a-project/` (docs/06-build-plan.md, task 5.2): the six-step project brief.
 *
 * Its copy is the `forms.start-a-project` setting and its service list the published
 * services (`GET /pages/start-a-project`), or the committed snapshot without the API. The
 * brief is saved as the visitor goes and sent through the lead flow as a PROJECT lead, so
 * the API's protections, storage and emails handle it like every other form.
 */
export default async function StartAProjectPage() {
  const view = await getFormsProjectPage();
  const { content } = view;

  return (
    <>
      <PageHero
        backdrop={content.backdrop ?? HERO_BACKDROPS.contact}
        crumbs={[{ name: content.hero.eyebrow, path: FORMS_ROUTES.startProject }]}
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        answer={content.hero.answer}
        intro={content.hero.intro}
      />
      <PageHasOwnForm />
      <ProjectFormSection
        content={content}
        form={
          <ProjectBriefForm
            copy={content.form}
            projectTypes={LEAD_PROJECT_TYPES}
            budgets={BUDGET_BANDS}
            timelines={START_TIMELINES}
            services={view.services}
            formId={FORMS_PROJECT_FORM_ID}
            thankYouPath={staticThankYouPathForLead('PROJECT')}
            turnstileSiteKey={process.env.TURNSTILE_SITE_KEY}
          />
        }
      />
      <ProjectWhatHappens content={content} />
      <ProjectWhatWeNeed content={content} />
      <ProjectAlternatives content={content} />
      <FaqSection
        heading={content.faq.heading}
        intro={content.faq.intro}
        items={view.faqs}
        group={FORMS_PROJECT_FAQ_GROUP}
        tone="white"
      />
    </>
  );
}
