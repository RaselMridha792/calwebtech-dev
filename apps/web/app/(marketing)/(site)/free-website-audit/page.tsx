import {
  FORMS_AUDIT_FAQ_GROUP,
  FORMS_AUDIT_FORM_ID,
  FORMS_ROUTES,
  LEAD_AUDIT_CONCERNS,
  staticThankYouPathForLead,
} from '@calwebtech/shared';
import type { Metadata } from 'next';
import { AuditForm } from '@/components/forms-pages/audit-form';
import { AuditCovers, AuditDelivery, AuditFormSection, AuditLimits } from '@/components/forms-pages/audit-sections';
import { PageHasOwnForm } from '@/components/site/conversion-band';
import { FaqSection } from '@/components/site/faq-section';
import { PageHero } from '@/components/site/page-hero';
import { getFormsAuditPage } from '@/lib/api/forms';
import { HERO_BACKDROPS } from '@/lib/hero-backdrops';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getFormsAuditPage();
  return sitePageMetadata({ ...content.seo, path: FORMS_ROUTES.freeWebsiteAudit });
}

/**
 * `/free-website-audit/` (docs/14-remaining-work.md, task 3): a request for a written review
 * of one site. The Resources menu and the contact page already point here.
 *
 * Its copy is the `forms.free-website-audit` setting (`GET /pages/free-website-audit`), or the
 * committed snapshot without the API. The request is an AUDIT lead through the lead flow, so
 * the API's protections, storage and emails handle it like every other form.
 */
export default async function FreeWebsiteAuditPage() {
  const view = await getFormsAuditPage();
  const { content } = view;

  return (
    <>
      <PageHero
        backdrop={content.backdrop ?? HERO_BACKDROPS.contact}
        crumbs={[{ name: content.hero.eyebrow, path: FORMS_ROUTES.freeWebsiteAudit }]}
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        answer={content.hero.answer}
        intro={content.hero.intro}
      />
      <PageHasOwnForm />
      <AuditFormSection
        content={content}
        form={
          <AuditForm
            copy={content.form}
            concerns={LEAD_AUDIT_CONCERNS}
            formId={FORMS_AUDIT_FORM_ID}
            thankYouPath={staticThankYouPathForLead('AUDIT')}
            turnstileSiteKey={process.env.TURNSTILE_SITE_KEY}
          />
        }
      />
      <AuditCovers content={content} />
      <AuditDelivery content={content} />
      <AuditLimits content={content} />
      <FaqSection
        heading={content.faq.heading}
        intro={content.faq.intro}
        items={view.faqs}
        group={FORMS_AUDIT_FAQ_GROUP}
        tone="white"
      />
    </>
  );
}
