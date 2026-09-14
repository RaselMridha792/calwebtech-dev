import { SITE_ROUTES, STATIC_CONTACT_FORM_ID, staticThankYouPathForLead } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { LeadForm } from '@/components/forms/lead-form';
import { JsonLd } from '@/components/seo/json-ld';
import { PageHasOwnForm } from '@/components/site/conversion-band';
import { PageHero } from '@/components/site/page-hero';
import { ContactDetailsCard, ContactFormSection, ContactNextSteps, EnquiryRouting } from '@/components/static/contact';
import { contactPageJsonLd } from '@/components/static/json-ld';
import { getStaticContact } from '@/lib/api/static';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getStaticContact();
  // `?enquiry=` only chooses the form's topic, so every variant canonicalises to /contact/.
  return sitePageMetadata({ ...content.seo, path: SITE_ROUTES.contact });
}

/**
 * /contact/ (docs/03-page-specs.md): contact details, offices from published locations and
 * a contact form whose routed enquiry types come from `EnquiryType`. The form posts through
 * the lead flow as a CONTACT lead; the API checks the topic and routes the notification to
 * its mailbox. `?enquiry=<slug>` chooses the topic, so menus can link to "Free website audit".
 */
export default async function ContactPage({ searchParams }: PageProps<'/contact'>) {
  const [view, query] = await Promise.all([getStaticContact(), searchParams]);
  const { content } = view;
  const requested = typeof query.enquiry === 'string' ? query.enquiry : undefined;
  const chosen = view.enquiryTypes.find((type) => type.slug === requested)?.slug;
  return (
    <>
      <PageHasOwnForm />
      <PageHero
        ground="light"
        crumbs={[{ name: 'Contact', path: SITE_ROUTES.contact }]}
        title={content.hero.title}
        intro={content.hero.intro}
        aside={<ContactDetailsCard view={view} />}
      />
      <ContactFormSection
        view={view}
        form={
          <LeadForm
            variant="full"
            formId={STATIC_CONTACT_FORM_ID}
            leadType="CONTACT"
            contactField="phone"
            permalink={SITE_ROUTES.contact}
            submitLabel={content.form.submitLabel}
            success={content.form.success}
            budgetOptions={[]}
            enquiry={{
              label: content.form.enquiryLabel,
              options: view.enquiryTypes.map((type) => ({ value: type.slug, label: type.name })),
              ...(chosen ? { defaultValue: chosen } : {}),
            }}
            message={{ label: content.form.messageLabel, placeholder: content.form.messagePlaceholder }}
            footnote={content.form.footnote}
            thankYouPath={staticThankYouPathForLead('CONTACT')}
            turnstileSiteKey={process.env.TURNSTILE_SITE_KEY}
          />
        }
      />
      <EnquiryRouting view={view} />
      <ContactNextSteps view={view} />
      <JsonLd
        data={contactPageJsonLd({ name: content.hero.title, description: content.seo.description, path: SITE_ROUTES.contact })}
      />
    </>
  );
}
