import type { FinalPointIcon, LandingPageView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { BackdropImage, Wordmark } from '../ui/brand';
import { CalendarIcon, PhoneIcon, ShieldIcon, TickIcon } from '../ui/icons';
import { reveal } from '../ui/primitives';
import { FaqAccordion } from './faq-accordion';

type Content = LandingPageView['content'];

export function GuaranteesSection({ guarantees }: { guarantees: Content['guarantees'] }) {
  if (guarantees.items.length === 0) return null;
  return (
    <section className="content-auto bg-white py-20 lg:py-24">
      <div className="shell-narrow">
        <h2
          className="max-w-[22ch] font-display text-[28px] leading-[1.15] font-extrabold text-ink lg:text-[34px]"
          {...reveal()}
        >
          {guarantees.heading}
        </h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {guarantees.items.map((item, index) => (
            <li key={item.title} className="lift rounded-2xl border border-line p-6" {...reveal(index)}>
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
    <section className="content-auto band-gradient relative overflow-hidden py-20 text-white lg:py-24">
      <div className="absolute inset-0" aria-hidden="true">
        <BackdropImage image={pricing.backgroundImage} className="opacity-[.13] mix-blend-luminosity" />
        <div className="grid-lines-light absolute inset-0" />
        <div className="absolute -bottom-40 -left-24 h-[560px] w-[560px] rounded-full bg-glow-teal-25 blur-3xl" />
      </div>
      <div className="shell-narrow relative grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5" {...reveal()}>
          <h2 className="font-display text-[32px] leading-[1.08] font-extrabold lg:text-[42px]">
            {pricing.heading}
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-white/75">{pricing.intro}</p>
          <a
            href="#form"
            className="mt-8 inline-flex h-14 items-center rounded-xl bg-white px-7 font-semibold text-ink hover:bg-mist"
          >
            {pricing.ctaLabel}
          </a>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
          {tiers.map((tier, index) => (
            <li
              key={tier.name}
              className={`rounded-2xl p-6 ${tier.highlighted ? 'bg-white text-ink' : 'glass'}`}
              {...reveal(index)}
            >
              <h3 className="font-display text-[16px] font-bold">{tier.name}</h3>
              <p className="mt-3 font-display text-[26px] font-extrabold">{tier.priceLabel}</p>
              <p
                className={`mt-3 text-[14px] leading-relaxed ${tier.highlighted ? 'text-body' : 'text-white/70'}`}
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
    <section className="content-auto bg-white py-20 lg:py-28">
      <div className="shell-narrow grid gap-12 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-4" {...reveal()}>
          <h2 className="font-display text-[32px] leading-[1.1] font-extrabold text-ink lg:text-[40px]">
            {faq.heading}
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed">{faq.intro}</p>
          <a
            href={`tel:${contact.phoneE164}`}
            className="mt-7 inline-flex h-12 items-center rounded-lg border border-line px-6 font-semibold text-ink hover:border-ink hover:bg-mist2"
          >
            {faq.callLabel}
          </a>
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
    <section id="final" className="content-auto relative overflow-hidden border-t border-line bg-mist py-20 lg:py-28">
      <div className="absolute inset-0" aria-hidden="true">
        <BackdropImage image={finalCta.backgroundImage} className="opacity-[.13]" />
        <div className="absolute inset-0 bg-linear-to-r from-mist via-mist/92 to-mist/70" />
        <div className="absolute -top-24 left-1/3 h-[520px] w-[520px] rounded-full bg-primary/[.09] blur-3xl" />
      </div>
      <div className="shell-narrow relative grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5" {...reveal()}>
          <h2 className="font-display text-[32px] leading-[1.08] font-extrabold text-ink lg:text-[44px]">
            {finalCta.heading}
          </h2>
          <p className="mt-5 max-w-[48ch] text-[17px] leading-relaxed">{finalCta.intro}</p>
          {finalCta.points.length > 0 ? (
            <ul className="mt-9 space-y-5 border-t border-line pt-8">
              {finalCta.points.map((point) => (
                <li key={point.title} className="flex gap-4">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-white text-ink"
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
    <footer className="bg-ink py-12 text-white/60">
      <div className="shell-narrow flex flex-wrap items-center justify-between gap-8">
        <Wordmark tone="light" />
        <p className="text-[14px] leading-relaxed">
          <a href={`tel:${contact.phoneE164}`} className="hover:text-white">
            {contact.phone}
          </a>
          <span className="mx-2 text-white/25" aria-hidden="true">
            |
          </span>
          <a href={`mailto:${contact.email}`} className="hover:text-white">
            {contact.email}
          </a>
        </p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px]">
          <a href="/privacy-policy/" className="hover:text-white">
            Privacy policy
          </a>
          <a href="/terms/" className="hover:text-white">
            Terms
          </a>
          <a href="/accessibility/" className="hover:text-white">
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
      <div className="fixed inset-x-0 bottom-0 z-50 flex gap-3 border-t border-line bg-white p-3 shadow-dock lg:hidden">
        <a
          href={`tel:${contact.phoneE164}`}
          className="grid w-14 shrink-0 place-items-center rounded-xl border border-line text-ink"
          aria-label={`Call Calwebtech on ${contact.phone}`}
        >
          <PhoneIcon className="h-5 w-5" />
        </a>
        <a
          href="#form"
          className="inline-flex h-14 flex-1 items-center justify-center rounded-xl bg-primary font-semibold text-white"
        >
          {ctaLabel}
        </a>
      </div>
      <div className="h-20 lg:hidden" aria-hidden="true" />
    </>
  );
}
