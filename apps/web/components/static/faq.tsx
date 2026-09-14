import { SITE_ROUTES, type StaticFaqView } from '@calwebtech/shared';
import { faqPageJsonLd } from '@/lib/seo/json-ld';
import { FaqSection } from '../site/faq-section';
import { EmptyState } from '../site/lists';
import { Section } from '../site/section';
import { JsonLd } from '../seo/json-ld';

/** Jump links to each topic, under the hero's introduction. */
export function FaqTopics({ view }: { view: StaticFaqView }) {
  if (view.groups.length < 2) return null;
  return (
    <nav aria-labelledby="faq-topics-label" className="mt-9">
      <p id="faq-topics-label" className="text-[14px] font-semibold text-ink">
        {view.navLabel}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {view.groups.map((group) => (
          <li key={group.key}>
            <a
              href={`#${group.key}`}
              className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-4 text-[14.5px] font-medium text-ink hover:border-ink"
            >
              {group.heading}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const TONES = ['white', 'mist'] as const;

/**
 * Every published question, one section per topic in the configured order, and a single
 * FAQPage node for all of them (one per page, docs/10-site-pages.md).
 */
export function FaqGroups({ view }: { view: StaticFaqView }) {
  if (view.groups.length === 0) {
    return (
      <Section tone="white" deferred={false}>
        <EmptyState action={{ label: view.cta.primaryCta.label, href: SITE_ROUTES.contact }}>{view.empty}</EmptyState>
      </Section>
    );
  }
  return (
    <>
      {view.groups.map((group, index) => (
        <FaqSection
          key={group.key}
          id={group.key}
          heading={group.heading}
          intro={group.intro}
          items={group.items}
          group={`faq-${group.key}`}
          tone={TONES[index % TONES.length]}
          jsonLd={false}
        />
      ))}
      <JsonLd data={faqPageJsonLd(view.groups.flatMap((group) => group.items))} />
    </>
  );
}
