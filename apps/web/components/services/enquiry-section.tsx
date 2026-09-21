import { BUDGET_BANDS, SERVICE_ENQUIRY_ANCHOR, SERVICE_ENQUIRY_FORM_ID, START_TIMELINES, servicePath, type ServiceDetailView } from '@calwebtech/shared';
import { LeadForm } from '@/components/forms/lead-form';
import { Section, groundOf, type SectionTone } from '@/components/site/section';
import { SectionHeading } from '@/components/site/section-heading';
import { reveal } from '@/components/ui/primitives';

/**
 * The inline enquiry form, carrying the service as context: the lead is stored as a service
 * enquiry, linked to this service by the API, and answered with this page's success copy.
 * The hero's primary call to action links here.
 */
export function EnquirySection({
  page,
  tone,
  turnstileSiteKey,
}: {
  page: Pick<ServiceDetailView, 'slug' | 'title' | 'enquiry'>;
  tone: SectionTone;
  turnstileSiteKey: string | undefined;
}) {
  const { enquiry } = page;
  const ground = groundOf(tone);
  const headingId = `${SERVICE_ENQUIRY_ANCHOR}-heading`;
  return (
    <Section id={SERVICE_ENQUIRY_ANCHOR} tone={tone} labelledBy={headingId}>
      <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeading id={headingId} title={enquiry.heading} intro={enquiry.intro} ground={ground} className="mb-0" />
          <p className={`mt-7 inline-flex  px-4 py-2.5 text-[14.5px] ${ground === 'dark' ? 'bg-navy-900-invert/10' : 'border border-hairline bg-canvas-raised text-ink'}`}>
            <span>
              Enquiring about <b>{page.title}</b>
            </span>
          </p>
        </div>
        <div className="lg:col-span-7" {...reveal(1)}>
          <LeadForm
            variant="full"
            formId={SERVICE_ENQUIRY_FORM_ID}
            leadType="SERVICE_ENQUIRY"
            serviceSlug={page.slug}
            permalink={servicePath(page.slug)}
            submitLabel={enquiry.submitLabel}
            success={enquiry.success}
            budgetOptions={BUDGET_BANDS}
            timelineOptions={START_TIMELINES}
            footnote={enquiry.footnote ?? undefined}
            turnstileSiteKey={turnstileSiteKey}
            className="border border-hairline bg-canvas-raised p-7 text-ink-muted sm:p-9"
          />
        </div>
      </div>
    </Section>
  );
}
