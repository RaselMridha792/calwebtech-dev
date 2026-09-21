import {
  GLOSSARY_ROUTE,
  caseStudyPath,
  glossaryTermPath,
  servicePath,
  type GlossaryTermView,
} from '@calwebtech/shared';
import { JsonLd } from '../seo/json-ld';
import { PageHero } from '../site/page-hero';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { formatUpdated } from './format-updated';
import { definedTermJsonLd } from './json-ld';

/** Paragraphs at a readable measure, keyed by their opening words. */
function Paragraphs({ paragraphs }: { paragraphs: readonly string[] }) {
  return (
    <div className="max-w-[72ch] space-y-4 text-[17px] leading-relaxed">
      {paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}
    </div>
  );
}

/**
 * `/glossary/<term>/` (docs/03-page-specs.md): the one-sentence definition opens the page as
 * the answer block, then what it means in practice, why it matters commercially, a concrete
 * example from work we have published, the delivering service, related terms and the date.
 */
export function GlossaryTermPage({ page }: { page: GlossaryTermView }) {
  const path = glossaryTermPath(page.slug);
  return (
    <>
      <PageHero
        crumbs={[
          { name: 'Glossary', path: GLOSSARY_ROUTE },
          { name: page.term, path },
        ]}
        eyebrow="Glossary"
        title={page.term}
        answer={page.answerBlock ?? page.definition}
      >
        <p className="mt-8 text-[14px] text-ink-invert-muted">{`Last updated ${formatUpdated(page.updatedAt)}`}</p>
      </PageHero>

      <Section id="meaning" tone="white" deferred={false} labelledBy="meaning-heading">
        <SectionHeading id="meaning-heading" title={page.body.heading} size="medium" className="mb-6" />
        <Paragraphs paragraphs={page.body.paragraphs} />
        {page.sources.length > 0 ? (
          <div className="mt-8 max-w-[72ch] border-t border-hairline pt-5">
            <p className="text-[13px] font-semibold text-ink">Sources</p>
            <ul className="mt-2 space-y-1.5 text-[15px]">
              {page.sources.map((source) => (
                <li key={source.href}>
                  <a
                    href={source.href}
                    className="font-semibold text-gold-ink underline underline-offset-4 hover:text-gold-600"
                    rel="noreferrer"
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      {page.commercial ? (
        <Section id="commercial" tone="mist" labelledBy="commercial-heading">
          <SectionHeading id="commercial-heading" title={page.commercial.heading} size="medium" className="mb-6" />
          <Paragraphs paragraphs={page.commercial.paragraphs} />
        </Section>
      ) : null}

      {page.example ? (
        <Section id="example" tone="white" labelledBy="example-heading">
          <SectionHeading id="example-heading" title={page.example.heading} size="medium" className="mb-6" />
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <Paragraphs paragraphs={[page.example.body]} />
            </div>
            {page.example.caseStudy ? (
              <div className="lg:col-span-5">
                <div className="border border-hairline bg-canvas-raised p-7">
                  <p className="font-display text-[19px] font-bold text-ink">{page.example.caseStudy.clientName}</p>
                  <dl className="mt-5 flex flex-col-reverse">
                    <dt className="mt-1.5 text-[13.5px]">{page.example.caseStudy.metric.label}</dt>
                    <dd className="font-display text-[34px] leading-none font-extrabold text-gold-ink">
                      {page.example.caseStudy.metric.value}
                    </dd>
                  </dl>
                  <a
                    href={caseStudyPath(page.example.caseStudy.slug)}
                    className="mt-6 inline-block font-semibold text-gold-ink hover:text-gold-600"
                  >
                    Read the case study
                    <span className="sr-only">{`: ${page.example.caseStudy.clientName}`}</span>
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {page.service || page.related ? (
        <Section id="next" tone="tint" labelledBy={page.related ? 'related-heading' : undefined}>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            {page.related ? (
              <div className="lg:col-span-7">
                <SectionHeading id="related-heading" title={page.related.heading} size="medium" className="mb-6" />
                <ul className="grid gap-4 sm:grid-cols-2">
                  {page.related.terms.map((term) => (
                    <li key={term.slug} className="relative border border-hairline bg-canvas-raised p-5">
                      <p className="font-semibold text-ink">
                        <a href={glossaryTermPath(term.slug)} className="after:absolute after:inset-0 hover:text-gold-ink">
                          {term.term}
                        </a>
                      </p>
                      <p className="mt-1.5 text-[14.5px] leading-relaxed">{term.definition}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-[15px]">
                  <a href={GLOSSARY_ROUTE} className="font-semibold text-gold-ink hover:text-gold-600">
                    Browse the full glossary
                  </a>
                </p>
              </div>
            ) : null}
            {page.service ? (
              <div className="lg:col-span-5">
                <div className="border border-hairline bg-canvas-raised p-7 ">
                  <p className="text-[13px] font-semibold text-gold-ink">Who does this work?</p>
                  <p className="mt-2 font-display text-[21px] leading-snug font-bold text-ink">{page.service.title}</p>
                  {page.service.line ? <p className="mt-3 text-[15.5px] leading-relaxed">{page.service.line}</p> : null}
                  <a
                    href={servicePath(page.service.slug)}
                    className="mt-6 inline-flex h-12 items-center bg-navy-900 px-6 text-[15.5px] font-semibold text-ink-invert hover:bg-navy-700"
                  >
                    See the service
                    <span className="sr-only">{`: ${page.service.title}`}</span>
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      <JsonLd data={definedTermJsonLd({ term: page.term, definition: page.definition, slug: page.slug })} />
    </>
  );
}
