import {
  GLOSSARY_ROUTE,
  GUIDES_ROUTE,
  GUIDE_GATE_ANCHOR,
  GUIDE_GATE_FORM_ID,
  glossaryTermPath,
  guidePath,
  servicePath,
  type GuideDetailView,
} from '@calwebtech/shared';
import { JsonLd } from '../seo/json-ld';
import { CardGrid, LinkCard } from '../site/cards';
import { FaqSection } from '../site/faq-section';
import { CheckList } from '../site/lists';
import { PageHero } from '../site/page-hero';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { ResponsiveImage } from '../ui/responsive-image';
import { formatUpdated } from './format-updated';
import { GuideGate } from './guide-gate';
import { guideArticleJsonLd } from './json-ld';

/** "15 September 2026", the way a dated resource reads. */
/** The cover and what the download is, beside the hero. */
function GuideAside({ page }: { page: GuideDetailView }) {
  const { hero, gate } = page;
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-sm">
      {hero.cover ? (
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-ink/40 shadow-media">
          <ResponsiveImage
            src={hero.cover.src}
            alt={hero.cover.alt}
            fill
            sizes="(min-width: 1024px) 32vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            priority
          />
        </div>
      ) : null}
      <p className={`${hero.cover ? 'mt-5 ' : ''}text-[14px] text-white/75`}>{gate.fileLabel}</p>
      <a
        href={`#${GUIDE_GATE_ANCHOR}`}
        className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-white px-6 text-[15.5px] font-semibold text-ink hover:bg-mist"
      >
        {hero.ctaLabel}
      </a>
    </div>
  );
}

/** The ungated summary: the argument of the guide, readable without giving an email address. */
function GuideSummary({ page }: { page: GuideDetailView }) {
  const { summary } = page;
  return (
    <Section id="summary" tone="white" deferred={false} labelledBy="summary-heading">
      <SectionHeading id="summary-heading" title={summary.heading} intro={summary.intro} className="mb-10" />
      <div className="max-w-[72ch] space-y-10">
        {summary.sections.map((section) => (
          <div key={section.id} id={section.id}>
            {section.heading ? (
              <h3 className="font-display text-[22px] leading-snug font-bold text-ink lg:text-[26px]">{section.heading}</h3>
            ) : null}
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="mt-4 text-[17px] leading-relaxed">
                {paragraph}
              </p>
            ))}
            {section.bullets.length > 0 ? (
              <div className="mt-6">
                <CheckList items={section.bullets} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

/**
 * `/guides/<slug>/`: the whole summary first, then the email gate in front of the file
 * (docs/03-page-specs.md). Gating the summary would make the page invisible, so it never
 * does. The gate is the only client component on the route.
 */
export function GuideDetail({ page, turnstileSiteKey }: { page: GuideDetailView; turnstileSiteKey?: string }) {
  const path = guidePath(page.slug);
  return (
    <>
      <PageHero
        crumbs={[
          { name: 'Guides', path: GUIDES_ROUTE },
          { name: page.title, path },
        ]}
        eyebrow="Guide"
        title={page.title}
        answer={page.answerBlock}
        intro={page.hero.intro}
        aside={<GuideAside page={page} />}
      >
        {page.updatedAt ? (
          <p className="mt-8 text-[14px] text-white/70">{`Last updated ${formatUpdated(page.updatedAt)}`}</p>
        ) : null}
      </PageHero>

      <GuideSummary page={page} />

      {page.takeaways ? (
        <Section id="takeaways" tone="mist" labelledBy="takeaways-heading">
          <SectionHeading id="takeaways-heading" title={page.takeaways.heading} size="medium" className="mb-8" />
          <div className="max-w-[72ch]">
            <CheckList items={page.takeaways.items} />
          </div>
        </Section>
      ) : null}

      <Section id={GUIDE_GATE_ANCHOR} tone="tint" labelledBy="download-heading">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeading id="download-heading" title={page.gate.heading} intro={page.gate.intro} className="mb-0" />
          </div>
          <div className="lg:col-span-7">
            <GuideGate
              slug={page.slug}
              permalink={path}
              gate={page.gate}
              formId={GUIDE_GATE_FORM_ID}
              {...(turnstileSiteKey ? { turnstileSiteKey } : {})}
            />
          </div>
        </div>
      </Section>

      {page.sources ? (
        <Section id="sources" tone="white" labelledBy="sources-heading">
          <div className="max-w-[72ch]">
            <SectionHeading id="sources-heading" title={page.sources.heading} size="medium" className="mb-6" />
            <ul className="space-y-3 text-[16px]">
              {page.sources.items.map((source) => (
                <li key={source.href}>
                  <a
                    href={source.href}
                    className="font-semibold text-primary underline underline-offset-4 hover:text-primaryd"
                    rel="noreferrer"
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ) : null}

      {page.faq ? (
        <FaqSection
          id="faq"
          heading={page.faq.heading}
          intro={page.faq.intro}
          items={page.faq.items}
          group="guide-faq"
          tone="mist"
        />
      ) : null}

      {page.service ? (
        <Section id="service" tone="ink" labelledBy="service-heading">
          <div className="max-w-[72ch]">
            <SectionHeading
              id="service-heading"
              title={page.service.heading}
              intro={page.service.intro}
              ground="dark"
              size="medium"
              className="mb-6"
            />
            <p className="text-[17px] leading-relaxed text-white/80">{page.service.item.line}</p>
            <a
              href={servicePath(page.service.item.slug)}
              className="mt-8 inline-flex h-14 items-center rounded-xl bg-white px-7 text-[16px] font-semibold text-ink hover:bg-mist"
            >
              {page.service.item.title}
            </a>
          </div>
        </Section>
      ) : null}

      {page.related ? (
        <Section id="related" tone="white" labelledBy="related-heading">
          <SectionHeading id="related-heading" title={page.related.heading} className="mb-10" />
          {page.related.guides.length > 0 ? (
            <CardGrid columns={2}>
              {page.related.guides.map((guide, index) => (
                <LinkCard
                  key={guide.slug}
                  href={guidePath(guide.slug)}
                  title={guide.title}
                  eyebrow={guide.pageCountLabel ?? 'Guide'}
                  body={guide.summary}
                  step={index}
                />
              ))}
            </CardGrid>
          ) : null}
          {page.related.terms.length > 0 ? (
            <ul className={`${page.related.guides.length > 0 ? 'mt-10 ' : ''}flex flex-wrap gap-3`}>
              {page.related.terms.map((term) => (
                <li key={term.slug}>
                  <a
                    href={glossaryTermPath(term.slug)}
                    className="inline-flex min-h-11 items-center rounded-xl border border-line bg-mist2 px-4 py-2 text-[15px] font-semibold text-ink hover:border-ink"
                  >
                    {term.term}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-8 text-[15px]">
            <a href={GLOSSARY_ROUTE} className="font-semibold text-primary hover:text-primaryd">
              Browse the full glossary
            </a>
          </p>
        </Section>
      ) : null}

      <JsonLd
        data={guideArticleJsonLd({
          headline: page.title,
          description: page.seo.description,
          path,
          image: page.hero.cover?.src ?? null,
          dateModified: page.updatedAt,
          about: [
            ...(page.service ? [page.service.item.title] : []),
            ...(page.related?.terms.map((term) => term.term) ?? []),
          ],
        })}
      />
    </>
  );
}
