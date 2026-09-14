import type { FaqItem } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { faqPageJsonLd } from '@/lib/seo/json-ld';
import { FaqAccordion } from '../landing/faq-accordion';
import { JsonLd } from '../seo/json-ld';
import { reveal } from '../ui/primitives';
import { Section } from './section';

/**
 * Questions and answers, one open at a time with no script (native `<details name>`), and
 * the FAQPage node for them. Renders nothing without items. A page carries one FAQPage
 * node: pass `jsonLd={false}` to any second list on the same page.
 */
export function FaqSection({
  id = 'faq',
  heading,
  intro,
  items,
  group,
  tone = 'white',
  aside,
  jsonLd = true,
}: {
  id?: string;
  /** Written as the question a buyer types. */
  heading: string;
  intro?: string | null;
  items: readonly Pick<FaqItem, 'id' | 'question' | 'answer'>[];
  /** Name of the exclusive disclosure group, unique on the page. */
  group: string;
  tone?: 'white' | 'mist' | 'tint';
  /** Under the intro, such as a call link. */
  aside?: ReactNode;
  jsonLd?: boolean;
}) {
  if (items.length === 0) return null;
  const headingId = `${id}-heading`;
  return (
    <Section id={id} tone={tone} labelledBy={headingId}>
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-4" {...reveal()}>
          <h2 id={headingId} className="font-display text-[32px] leading-[1.1] font-extrabold text-ink lg:text-[40px]">
            {heading}
          </h2>
          {intro ? <p className="mt-5 text-[17px] leading-relaxed">{intro}</p> : null}
          {aside}
        </div>
        <div className="lg:col-span-8">
          <FaqAccordion items={[...items]} group={group} />
        </div>
      </div>
      {jsonLd ? <JsonLd data={faqPageJsonLd(items)} /> : null}
    </Section>
  );
}
