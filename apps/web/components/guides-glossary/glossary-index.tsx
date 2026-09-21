import { GLOSSARY_ROUTE, glossaryTermPath, type GlossaryIndexView } from '@calwebtech/shared';
import { JsonLd } from '../seo/json-ld';
import { EmptyState } from '../site/lists';
import { PageHero } from '../site/page-hero';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { reveal } from '../ui/primitives';
import { formatUpdated } from './format-updated';
import { definedTermSetJsonLd } from './json-ld';

/** The anchor a jump link points at. "#" files under `letter-other`. */
export function letterAnchor(letter: string): string {
  return `letter-${/^[A-Z]$/.test(letter) ? letter.toLowerCase() : 'other'}`;
}

/** How a letter group is named for assistive technology, since the big letter is decoration. */
function letterLabel(letter: string): string {
  return letter === '#' ? 'Terms beginning with a number' : `Terms beginning with ${letter}`;
}

/**
 * `/glossary/`: every published term A to Z, with jump links to each letter. The letters are
 * navigation, not section headings, so they are labels on the group rather than headings:
 * the page keeps one H1 and question-shaped H2s.
 */
export function GlossaryIndex({ view }: { view: GlossaryIndexView }) {
  const { content, groups } = view;
  const terms = groups.flatMap((group) => group.terms);
  return (
    <>
      <PageHero
        crumbs={[{ name: 'Glossary', path: GLOSSARY_ROUTE }]}
        eyebrow="Resources"
        title={content.title}
        answer={content.answerBlock}
        intro={content.intro}
      >
        {view.updatedAt ? (
          <p className="mt-8 text-[14px] text-ink-invert-muted">{`${String(terms.length)} terms, last updated ${formatUpdated(view.updatedAt)}`}</p>
        ) : null}
      </PageHero>

      <Section id="terms" tone="white" deferred={false} labelledBy="terms-heading">
        <SectionHeading id="terms-heading" title={content.list.heading} intro={content.list.intro} className="mb-8" />

        {groups.length === 0 ? (
          <EmptyState action={content.elsewhere.primaryCta}>{content.list.empty}</EmptyState>
        ) : (
          <>
            <nav aria-label={content.jumpLabel} className="border-y border-hairline py-4">
              <ul className="flex flex-wrap gap-2">
                {groups.map((group) => (
                  <li key={group.letter}>
                    <a
                      href={`#${letterAnchor(group.letter)}`}
                      className="inline-flex h-11 min-w-11 items-center justify-center border border-hairline px-3 font-display text-[15px] font-bold text-ink hover:border-ink hover:bg-canvas-raised"
                    >
                      <span aria-hidden="true">{group.letter}</span>
                      <span className="sr-only">{letterLabel(group.letter)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-12 space-y-12">
              {groups.map((group, index) => (
                <section key={group.letter} id={letterAnchor(group.letter)} aria-label={letterLabel(group.letter)}>
                  <p className="font-display text-[30px] leading-none font-extrabold text-gold-ink" aria-hidden="true">
                    {group.letter}
                  </p>
                  <ul className="mt-5 grid gap-5 border-t border-hairline pt-6 md:grid-cols-2 lg:grid-cols-3">
                    {group.terms.map((term) => (
                      <li key={term.slug} className="lift relative border border-hairline bg-canvas-raised p-6" {...reveal(index)}>
                        <p className="font-display text-[18px] leading-snug font-bold text-ink">
                          <a href={glossaryTermPath(term.slug)} className="after:absolute after:inset-0 hover:text-gold-ink">
                            {term.term}
                          </a>
                        </p>
                        <p className="mt-2 text-[15px] leading-relaxed">{term.definition}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section id="method" tone="mist" labelledBy="method-heading">
        <div className="max-w-[72ch]">
          <SectionHeading id="method-heading" title={content.method.heading} size="medium" className="mb-6" />
          <p className="text-[17px] leading-relaxed">{content.method.body}</p>
        </div>
      </Section>

      <Section id="elsewhere" tone="white" labelledBy="elsewhere-heading">
        <div className="max-w-[72ch]">
          <SectionHeading id="elsewhere-heading" title={content.elsewhere.heading} size="medium" className="mb-6" />
          <p className="text-[17px] leading-relaxed">{content.elsewhere.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={content.elsewhere.primaryCta.href}
              className="inline-flex h-14 items-center bg-navy-900 px-7 text-[16px] font-semibold text-ink-invert  hover:bg-navy-700"
            >
              {content.elsewhere.primaryCta.label}
            </a>
            {content.elsewhere.secondaryCta ? (
              <a
                href={content.elsewhere.secondaryCta.href}
                className="inline-flex h-14 items-center border border-hairline bg-canvas-raised px-7 text-[16px] font-semibold text-ink hover:border-ink"
              >
                {content.elsewhere.secondaryCta.label}
              </a>
            ) : null}
          </div>
        </div>
      </Section>

      {terms.length > 0 ? (
        <JsonLd
          data={definedTermSetJsonLd({ name: content.title, description: content.seo.description, terms })}
        />
      ) : null}
    </>
  );
}
