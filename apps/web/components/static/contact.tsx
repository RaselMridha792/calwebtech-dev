import { SITE_ROUTES, type StaticContactView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { reveal } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';
import { ContactLinks, PointGrid } from './parts';

/** The anchor of the form, so a routed link can land on it with its topic chosen. */
export const CONTACT_FORM_ID = 'contact-form';

/** Phone, email and how quickly a person replies, beside the hero. */
export function ContactDetailsCard({ view }: { view: StaticContactView }) {
  const { details } = view.content;
  return (
    <div className="rounded-2xl border border-line bg-white p-7 shadow-panel sm:p-8">
      <h2 className="font-display text-[22px] font-extrabold text-ink">{details.heading}</h2>
      <div className="mt-5">
        <ContactLinks contact={view.contact} phoneLabel={details.phoneLabel} emailLabel={details.emailLabel} />
      </div>
      <p className="mt-6 border-t border-line pt-5 text-[15px] leading-relaxed">{details.response}</p>
    </div>
  );
}

/** The contact form beside the offices and a photograph. The form itself is the page's `LeadForm`. */
export function ContactFormSection({ view, form }: { view: StaticContactView; form: ReactNode }) {
  const { content, offices } = view;
  return (
    <Section id={CONTACT_FORM_ID} tone="white" labelledBy="contact-form-heading" deferred={false}>
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <h2 id="contact-form-heading" className="font-display text-[30px] leading-tight font-extrabold text-ink lg:text-[36px]">
            {content.form.heading}
          </h2>
          <p className="mt-3 max-w-[60ch] text-[16.5px] leading-relaxed">{content.form.intro}</p>
          <div className="mt-8">{form}</div>
        </div>
        <div className="space-y-8 lg:col-span-5">
          {content.image ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-mist shadow-media">
              <ResponsiveImage
                src={content.image.src}
                alt={content.image.alt}
                fill
                sizes="(min-width: 1024px) 38vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : null}
          {offices.length > 0 ? (
            <div>
              <h3 className="font-display text-[19px] font-bold text-ink">{content.details.officesLabel}</h3>
              <ul className="mt-4 grid gap-5 sm:grid-cols-2">
                {offices.map((office) => (
                  <li key={office.city} className="rounded-xl border border-line bg-mist2 p-5">
                    <p className="font-semibold text-ink">{office.city}</p>
                    <address className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-line not-italic">
                      {office.address}
                    </address>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

/** Where each topic goes, with a link that opens the form with that topic chosen. */
export function EnquiryRouting({ view }: { view: StaticContactView }) {
  const { routing } = view.content;
  if (view.enquiryTypes.length === 0) return null;
  return (
    <Section id="routing" tone="mist" labelledBy="routing-heading">
      <SectionHeading id="routing-heading" title={routing.heading} intro={routing.intro} />
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {view.enquiryTypes.map((type, index) => (
          <li key={type.slug} className="flex flex-col rounded-2xl border border-line bg-white p-7" {...reveal(index)}>
            <h3 className="font-display text-[19px] font-bold text-ink">{type.name}</h3>
            {type.description ? <p className="mt-2.5 text-[15.5px] leading-relaxed">{type.description}</p> : null}
            <a
              href={`${SITE_ROUTES.contact}?enquiry=${encodeURIComponent(type.slug)}#${CONTACT_FORM_ID}`}
              className="mt-auto inline-block self-start pt-5 font-semibold text-primary hover:text-primaryd"
            >
              {routing.linkLabel}
              <span className="sr-only">{`: ${type.name}`}</span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** What happens after a message is sent. */
export function ContactNextSteps({ view }: { view: StaticContactView }) {
  const { nextSteps } = view.content;
  return (
    <Section id="next-steps" tone="white" labelledBy="next-steps-heading">
      <SectionHeading id="next-steps-heading" title={nextSteps.heading} />
      <PointGrid items={nextSteps.steps} numbered columns={nextSteps.steps.length === 2 ? 2 : 3} />
    </Section>
  );
}
