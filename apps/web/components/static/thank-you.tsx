import type { StaticThankYouView } from '@calwebtech/shared';
import { CheckList } from '../site/lists';
import { Section } from '../site/section';
import { reveal } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';

/** When to expect a reply, and a telephone number for anyone who would rather talk. */
export function ThankYouResponse({ page }: { page: StaticThankYouView }) {
  return (
    <div className="border border-hairline bg-canvas-raised p-7 text-ink-muted sm:p-8">
      <p className="text-[14px] font-semibold text-ink-muted">{page.response.label}</p>
      <p className="mt-1.5 font-display text-[26px] leading-tight font-extrabold text-ink">{page.response.value}</p>
      <p className="mt-3 text-[15.5px] leading-relaxed">{page.response.detail}</p>
      <p className="mt-6 border-t border-hairline pt-5 text-[14px]">{page.callLabel}</p>
      <a
        href={`tel:${page.contact.phoneE164}`}
        className="mt-1 inline-block py-1 font-display text-[21px] font-bold text-ink hover:text-gold-ink"
      >
        {page.contact.phone}
      </a>
    </div>
  );
}

/** What the form sent, beside what happens next. */
export function ThankYouDetails({ page }: { page: StaticThankYouView }) {
  return (
    <Section tone="white" labelledBy="received-heading" deferred={false}>
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5" {...reveal()}>
          <h2 id="received-heading" className="font-display text-[26px] leading-tight font-extrabold text-ink lg:text-[30px]">
            {page.received.heading}
          </h2>
          <div className="mt-6">
            <CheckList items={page.received.items} />
          </div>
        </div>
        <div className="lg:col-span-7" {...reveal(1)}>
          <h2 className="font-display text-[26px] leading-tight font-extrabold text-ink lg:text-[30px]">
            {page.nextSteps.heading}
          </h2>
          <ol className="mt-6 space-y-4">
            {page.nextSteps.steps.map((step, index) => (
              <li key={step.title} className="flex gap-5 border border-hairline bg-canvas-raised p-6">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center bg-navy-900 font-display text-[15px] font-extrabold text-ink-invert"
                  aria-hidden="true"
                >
                  {String(index + 1)}
                </span>
                <span>
                  <b className="block font-display text-[18px] font-bold text-ink">{step.title}</b>
                  <span className="mt-1.5 block text-[15.5px] leading-relaxed">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  );
}

/** The secondary action and a few useful pages. */
export function ThankYouSecondary({ page }: { page: StaticThankYouView }) {
  return (
    <Section tone="mist" labelledBy="secondary-heading">
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6" {...reveal()}>
          <h2 id="secondary-heading" className="font-display text-[30px] leading-tight font-extrabold text-ink lg:text-[36px]">
            {page.secondary.heading}
          </h2>
          <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed">{page.secondary.body}</p>
          <a
            href={page.secondary.cta.href}
            className="mt-8 inline-flex h-14 items-center bg-navy-900 px-7 text-[16px] font-semibold text-ink-invert hover:bg-navy-700"
          >
            {page.secondary.cta.label}
          </a>
          {page.links.length > 0 ? (
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
              {page.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="inline-block py-1 font-semibold text-gold-ink hover:text-gold-600">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {page.image ? (
          <div className="lg:col-span-6">
            <div className="relative aspect-[16/10] overflow-hidden bg-canvas-sunken ">
              <ResponsiveImage
                src={page.image.src}
                alt={page.image.alt}
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
