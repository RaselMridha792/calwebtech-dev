import type { FormsAuditContent } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { CheckList, StepList } from '../site/lists';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { reveal } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';

/*
 * The sections of `/free-website-audit/` (docs/14-remaining-work.md, task 3). The request comes
 * first, as on the other application pages; what the audit covers, how it arrives and what it
 * is not follow. Grounds alternate white and tint down the page.
 */

/** The request form, with the page's assurances beside it on wide screens and under it on a phone. */
export function AuditFormSection({ content, form }: { content: FormsAuditContent; form: ReactNode }) {
  return (
    <Section id="audit-request" tone="white" labelledBy="audit-request-heading" deferred={false}>
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="min-w-0 lg:col-span-8">
          <h2 id="audit-request-heading" className="font-display text-[30px] leading-tight font-extrabold text-ink lg:text-[36px]">
            {content.form.heading}
          </h2>
          <p className="mt-3 max-w-[60ch] text-[16.5px] leading-relaxed">{content.form.intro}</p>
          <div className="mt-8">{form}</div>
        </div>
        <aside aria-label="What happens to your request" className="lg:col-span-4 lg:pt-2" {...reveal(1)}>
          <CheckList items={content.assurances} />
        </aside>
      </div>
    </Section>
  );
}

/** What the audit looks at, as editorial rows on hairlines. */
export function AuditCovers({ content }: { content: FormsAuditContent }) {
  const { covers } = content;
  return (
    <Section id="covers" tone="tint" labelledBy="covers-heading">
      <SectionHeading id="covers-heading" title={covers.heading} intro={covers.intro} />
      <ul className="grid gap-x-12 md:grid-cols-2">
        {covers.items.map((item, index) => (
          <li key={item.title} className="border-t border-hairline py-6" {...reveal(index % 2)}>
            <h3 className="heading-md text-ink">{item.title}</h3>
            <p className="body-base mt-2 max-w-[56ch] text-ink-muted">{item.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** How the findings arrive, as timed steps, beside the page's picture when it has one. */
export function AuditDelivery({ content }: { content: FormsAuditContent }) {
  const { delivery } = content;
  return (
    <Section id="delivery" tone="white" labelledBy="delivery-heading">
      <SectionHeading id="delivery-heading" title={delivery.heading} intro={delivery.intro} />
      <div className={delivery.image ? 'grid gap-12 lg:grid-cols-12 lg:gap-16' : ''}>
        <div className="min-w-0 lg:col-span-7">
          <StepList steps={delivery.steps} />
        </div>
        {delivery.image ? (
          <div className="relative aspect-[4/3] overflow-hidden bg-canvas-sunken lg:col-span-5" {...reveal(1)}>
            <ResponsiveImage
              src={delivery.image.src}
              alt={delivery.image.alt}
              fill
              sizes="(min-width: 1024px) 34vw, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/** What the audit is not, so nobody expects a strategy engagement from it. */
export function AuditLimits({ content }: { content: FormsAuditContent }) {
  const { limits } = content;
  return (
    <Section id="limits" tone="tint" labelledBy="limits-heading">
      <SectionHeading id="limits-heading" title={limits.heading} intro={limits.intro} />
      <ul className="max-w-[72ch]">
        {limits.items.map((item, index) => (
          <li key={item} className="body-lg border-t border-hairline py-4 text-ink" {...reveal(index)}>
            {item}
          </li>
        ))}
      </ul>
    </Section>
  );
}
