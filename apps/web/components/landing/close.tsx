import type { FinalPointIcon, LandingPageView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { BackdropImage } from '../ui/brand';
import { Logo } from '../ui/logo';
import { CalendarIcon, PhoneIcon, ShieldIcon, TickIcon } from '../ui/icons';
import { reveal } from '../ui/primitives';
import { FaqAccordion } from './faq-accordion';

type Content = LandingPageView['content'];

export function GuaranteesSection({ guarantees }: { guarantees: Content['guarantees'] }) {
  if (guarantees.items.length === 0) return null;
  return (
    <section className="content-auto bg-canvas-raised py-20 lg:py-24">
      <div className="shell-narrow">
        <h2
          className="max-w-[22ch] font-display text-[28px] leading-[1.15] font-extrabold text-ink lg:text-[34px]"
          {...reveal()}
        >
          {guarantees.heading}
        </h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {guarantees.items.map((item, index) => (
            <li key={item.title} className="lift border border-hairline p-6" {...reveal(index)}>
              <h3 className="font-display text-[17px] font-bold text-ink">{item.title}</h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function PricingSection({
  pricing,
  tiers,
}: {
  pricing: Content['pricing'];
  tiers: LandingPageView['pricingTiers'];
}) {
  if (tiers.length === 0) return null;
  return (
    <section className="content-auto relative bg-navy-900 overflow-hidden py-20 text-ink-invert lg:py-24">
      <div className="absolute inset-0" aria-hidden="true">
        <BackdropImage image={pricing.backgroundImage} className="opacity-[.13] mix-blend-luminosity" />
      </div>
      <div className="shell-narrow relative grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5" {...reveal()}>
          <h2 className="font-display text-[32px] leading-[1.08] font-extrabold lg:text-[42px]">
            {pricing.heading}
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-invert-muted">{pricing.intro}</p>
          <a
            href="#form"
            className="mt-8 inline-flex h-14 items-center bg-canvas-raised px-7 font-semibold text-ink hover:bg-canvas-sunken"
          >
            {pricing.ctaLabel}
          </a>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
          {tiers.map((tier, index) => (
            <li
              key={tier.name}
              className={` p-6 ${tier.highlighted ? 'bg-canvas-raised text-ink' : 'glass'}`}
              {...reveal(index)}
            >
              <h3 className="font-display text-[16px] font-bold">{tier.name}</h3>
              <p className="mt-3 font-display text-[26px] font-extrabold">{tier.priceLabel}</p>
              <p
                className={`mt-3 text-[14px] leading-relaxed ${tier.highlighted ? 'text-ink-muted' : 'text-ink-invert-muted'}`}
              >
                {tier.summary}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function FaqSection({
  faq,
  items,
  contact,
}: {
  faq: Content['faq'];
  items: LandingPageView['faqs'];
  contact: LandingPageView['contact'];
}) {
  if (items.length === 0) return null;
  return (
    <section className="content-auto bg-canvas-raised py-20 lg:py-28">
      <div className="shell-narrow grid gap-12 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-4" {...reveal()}>
          <h2 className="font-display text-[32px] leading-[1.1] font-extrabold text-ink lg:text-[40px]">
            {faq.heading}
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed">{faq.intro}</p>
          {contact.phoneE164 ? (
            <a
              href={`tel:${contact.phoneE164}`}
              className="mt-7 inline-flex h-12 items-center border border-hairline px-6 font-semibold text-ink hover:border-ink hover:bg-canvas-raised"
            >
              {faq.callLabel}
            </a>
          ) : null}
        </div>
        <div className="lg:col-span-8">
          <FaqAccordion items={items} group="landing-faq" />
        </div>
      </div>
    </section>
  );
}

const POINT_ICONS: Record<FinalPointIcon, ReactNode> = {
  check: <TickIcon className="h-4 w-4" />,
  shield: <ShieldIcon className="h-4 w-4" />,
  calendar: <CalendarIcon className="h-4 w-4" />,
};

export function FinalCtaSection({ finalCta, form }: { finalCta: Content['finalCta']; form: ReactNode }) {
  return (
    <section id="final" className="content-auto relative overflow-hidden border-t border-hairline bg-canvas-sunken py-20 lg:py-28">
      <div className="absolute inset-0" aria-hidden="true">
        <BackdropImage image={finalCta.backgroundImage} className="opacity-[.13]" />
        <div className="absolute inset-0 bg-linear-to-r from-canvas-sunken via-canvas-sunken/92 to-canvas-sunken/70" />
      </div>
      <div className="shell-narrow relative grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5" {...reveal()}>
          <h2 className="font-display text-[32px] leading-[1.08] font-extrabold text-ink lg:text-[44px]">
            {finalCta.heading}
          </h2>
          <p className="mt-5 max-w-[48ch] text-[17px] leading-relaxed">{finalCta.intro}</p>
          {finalCta.points.length > 0 ? (
            <ul className="mt-9 space-y-5 border-t border-hairline pt-8">
              {finalCta.points.map((point) => (
                <li key={point.title} className="flex gap-4">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center border border-hairline bg-canvas-raised text-ink"
                    aria-hidden="true"
                  >
                    {POINT_ICONS[point.icon]}
                  </span>
                  <span>
                    <b className="block text-ink">{point.title}</b>
                    <span className="text-[14.5px]">{point.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="lg:col-span-7">{form}</div>
      </div>
    </section>
  );
}

export function LandingFooter({ contact }: { contact: LandingPageView['contact'] }) {
  return (
    <footer className="bg-navy-900 py-12 text-ink-invert-muted">
      <div className="shell-narrow flex flex-wrap items-center justify-between gap-8">
        <Logo tone="dark" layout="horizontal" height={46} />
        <p className="text-[14px] leading-relaxed">
          {contact.phone && contact.phoneE164 ? (
            <>
              <a href={`tel:${contact.phoneE164}`} className="hover:text-ink-invert">
                {contact.phone}
              </a>
              <span className="mx-2 text-ink-invert-muted" aria-hidden="true">
                |
              </span>
            </>
          ) : null}
          <a href={`mailto:${contact.email}`} className="hover:text-ink-invert">
            {contact.email}
          </a>
        </p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px]">
          <a href="/privacy-policy/" className="hover:text-ink-invert">
            Privacy policy
          </a>
          <a href="/terms/" className="hover:text-ink-invert">
            Terms
          </a>
          <a href="/accessibility/" className="hover:text-ink-invert">
            Accessibility
          </a>
          <span>&copy; {new Date().getFullYear()} Calwebtech</span>
        </nav>
      </div>
    </footer>
  );
}

/** Call and form shortcuts pinned to the bottom of small screens. */
export function StickyMobileCta({
  contact,
  ctaLabel,
}: {
  contact: LandingPageView['contact'];
  ctaLabel: string;
}) {
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 flex gap-3 border-t border-hairline bg-canvas-raised p-3 lg:hidden">
        {contact.phone && contact.phoneE164 ? (
          <a
            href={`tel:${contact.phoneE164}`}
            className="grid w-14 shrink-0 place-items-center border border-hairline text-ink"
            aria-label={`Call Calwebtech on ${contact.phone}`}
          >
            <PhoneIcon className="h-5 w-5" />
          </a>
        ) : null}
        <a
          href="#form"
          className="inline-flex h-14 flex-1 items-center justify-center bg-navy-900 font-semibold text-ink-invert"
        >
          {ctaLabel}
        </a>
      </div>
      <div className="h-20 lg:hidden" aria-hidden="true" />
    </>
  );
}
