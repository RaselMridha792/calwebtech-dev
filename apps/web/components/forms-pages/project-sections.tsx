import type { FormsProjectContent } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { CardGrid, LinkCard } from '../site/cards';
import { CheckList, StepList } from '../site/lists';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { reveal } from '../ui/primitives';

/*
 * The sections of `/start-a-project/` around the brief (docs/03-page-specs.md, application
 * pages). Tones alternate white and tint down the page, so no two neighbours share a ground.
 */

/** The brief itself, with the page's assurances beside it on wide screens and under it on a phone. */
export function ProjectFormSection({ content, form }: { content: FormsProjectContent; form: ReactNode }) {
  return (
    <Section id="brief" tone="white" labelledBy="brief-heading" deferred={false}>
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="min-w-0 lg:col-span-8">
          <h2 id="brief-heading" className="font-display text-[30px] leading-tight font-extrabold text-ink lg:text-[36px]">
            {content.form.heading}
          </h2>
          <p className="mt-3 max-w-[60ch] text-[16.5px] leading-relaxed">{content.form.intro}</p>
          <div className="mt-8">{form}</div>
        </div>
        <aside aria-label="What happens to your brief" className="lg:col-span-4 lg:pt-2" {...reveal(1)}>
          <CheckList items={content.assurances} />
        </aside>
      </div>
    </Section>
  );
}

/** What happens after the brief is sent, as timed steps. */
export function ProjectWhatHappens({ content }: { content: FormsProjectContent }) {
  const { whatHappens } = content;
  return (
    <Section id="what-happens" tone="tint" labelledBy="what-happens-heading">
      <SectionHeading id="what-happens-heading" title={whatHappens.heading} intro={whatHappens.intro} />
      <StepList steps={whatHappens.steps} />
    </Section>
  );
}

/** What changes a quote most, so the visitor knows what is worth telling us. */
export function ProjectWhatWeNeed({ content }: { content: FormsProjectContent }) {
  const { whatWeNeed } = content;
  return (
    <Section id="what-we-need" tone="white" labelledBy="what-we-need-heading">
      <SectionHeading id="what-we-need-heading" title={whatWeNeed.heading} intro={whatWeNeed.intro} />
      <div {...reveal(1)}>
        <CheckList items={whatWeNeed.items} columns={2} />
      </div>
      <p className="mt-8 max-w-[64ch] border-t border-hairline pt-6 text-[15.5px] leading-relaxed">{whatWeNeed.note}</p>
    </Section>
  );
}

/** Other ways in for someone who would rather not write a brief. */
export function ProjectAlternatives({ content }: { content: FormsProjectContent }) {
  const { alternatives } = content;
  const columns = alternatives.items.length === 2 || alternatives.items.length === 4 ? 2 : 3;
  return (
    <Section id="alternatives" tone="tint" labelledBy="alternatives-heading">
      <SectionHeading id="alternatives-heading" title={alternatives.heading} intro={alternatives.intro} />
      <CardGrid columns={columns}>
        {alternatives.items.map((item, index) => (
          <LinkCard
            key={item.title}
            href={item.link.href}
            title={item.title}
            body={item.body}
            linkLabel={item.link.label}
            step={index}
          />
        ))}
      </CardGrid>
    </Section>
  );
}
