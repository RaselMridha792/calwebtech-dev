import { GUIDES_ROUTE, guidePath, type GuidesIndexView } from '@calwebtech/shared';
import { CardGrid, LinkCard } from '../site/cards';
import { EmptyState } from '../site/lists';
import { PageHero } from '../site/page-hero';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';

/** "Guide · 28 pages", or just "Guide" when the record does not say how long it is. */
function guideMeta(pageCountLabel: string | null): string {
  return pageCountLabel === null ? 'Guide' : `Guide · ${pageCountLabel}`;
}

/**
 * `/guides/`: every published guide, the plain statement of what the email gate asks for,
 * and where to go instead. With nothing published the list is an empty state, which is what
 * the placeholder database renders.
 */
export function GuidesIndex({ view }: { view: GuidesIndexView }) {
  const { content, guides } = view;
  return (
    <>
      <PageHero
        crumbs={[{ name: 'Guides', path: GUIDES_ROUTE }]}
        eyebrow="Resources"
        title={content.title}
        answer={content.answerBlock}
        intro={content.intro}
      />

      <Section id="guides" tone="white" deferred={false} labelledBy="guides-heading">
        <SectionHeading id="guides-heading" title={content.list.heading} intro={content.list.intro} />
        {guides.length === 0 ? (
          <EmptyState action={content.elsewhere.primaryCta}>{content.list.empty}</EmptyState>
        ) : (
          <CardGrid columns={3}>
            {guides.map((guide, index) => (
              <LinkCard
                key={guide.slug}
                href={guidePath(guide.slug)}
                title={guide.title}
                eyebrow={guideMeta(guide.pageCountLabel)}
                body={guide.summary}
                image={guide.cover}
                meta={guide.topics.length > 0 ? guide.topics.join(' · ') : null}
                linkLabel={content.list.cardLinkLabel}
                step={index}
              />
            ))}
          </CardGrid>
        )}
      </Section>

      <Section id="gate-note" tone="mist" labelledBy="gate-note-heading">
        <div className="max-w-[72ch]">
          <SectionHeading id="gate-note-heading" title={content.gateNote.heading} size="medium" className="mb-6" />
          <p className="text-[17px] leading-relaxed">{content.gateNote.body}</p>
        </div>
      </Section>

      <Section id="elsewhere" tone="white" labelledBy="elsewhere-heading">
        <div className="max-w-[72ch]">
          <SectionHeading id="elsewhere-heading" title={content.elsewhere.heading} size="medium" className="mb-6" />
          <p className="text-[17px] leading-relaxed">{content.elsewhere.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={content.elsewhere.primaryCta.href}
              className="inline-flex h-14 items-center rounded-xl bg-primary px-7 text-[16px] font-semibold text-white shadow-cta hover:bg-primaryd"
            >
              {content.elsewhere.primaryCta.label}
            </a>
            {content.elsewhere.secondaryCta ? (
              <a
                href={content.elsewhere.secondaryCta.href}
                className="inline-flex h-14 items-center rounded-xl border border-line bg-white px-7 text-[16px] font-semibold text-ink hover:border-ink"
              >
                {content.elsewhere.secondaryCta.label}
              </a>
            ) : null}
          </div>
        </div>
      </Section>
    </>
  );
}
