import { SITE_ROUTES, caseStudyPath, type WorkCaseStudyView } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Fragment, type ReactNode } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import { MetricBand } from '@/components/site/bands';
import { PageHero } from '@/components/site/page-hero';
import type { SectionTone } from '@/components/site/section';
import {
  AtAGlance,
  CaseStudyBeforeAfter,
  CaseStudyHeadline,
  GallerySection,
  MeasurementNote,
  NarrativeSection,
  QuoteSection,
  RelatedCaseStudies,
  RelatedServices,
  hasAtAGlance,
  hasClientWords,
  type LightTone,
} from '@/components/work/case-study';
import { caseStudyArticleJsonLd, caseStudyReviewJsonLd } from '@/components/work/json-ld';
import { getCaseStudy } from '@/lib/api/work';
import type { JsonLdObject } from '@/lib/seo/json-ld';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata({ params }: PageProps<'/work/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const view = await getCaseStudy(slug);
  if (!view) return { robots: { index: false, follow: false } };
  return sitePageMetadata({
    ...view.seo,
    path: caseStudyPath(view.slug),
    ogImageAlt: view.cover?.alt,
    type: 'article',
  });
}

/**
 * A section of the case study. Light sections alternate white and tinted from the end of
 * the page backwards, so the last one is white against the closing band's tint, and the
 * before and after section is always ink.
 */
interface Part {
  key: string;
  /** Always ink; its render ignores the tone it is given. */
  ink?: boolean;
  render: (tone: LightTone) => ReactNode;
}

function withTones(parts: readonly Part[]): ReactNode[] {
  const rendered: ReactNode[] = [];
  let next: SectionTone = 'mist';
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (!part) continue;
    const tone: LightTone = next === 'white' ? 'tint' : 'white';
    rendered.unshift(<Fragment key={part.key}>{part.render(tone)}</Fragment>);
    next = part.ink ? 'ink' : tone;
  }
  return rendered;
}

function caseStudyParts(view: WorkCaseStudyView): Part[] {
  const { headings, labels } = view;
  const parts: Part[] = [
    {
      key: 'results',
      render: (tone) => (
        <MetricBand
          id="results"
          heading={headings.metrics}
          metrics={view.metrics}
          tone={tone === 'tint' ? 'mist' : tone}
          // Without an outcome section, the measurement method sits under the figures.
          note={view.outcome ? null : `${labels.measurement}: ${view.measurement}`}
        />
      ),
    },
  ];
  if (hasAtAGlance(view)) parts.push({ key: 'at-a-glance', render: (tone) => <AtAGlance view={view} tone={tone} /> });
  const narrative = (key: string, heading: string, paragraphs: readonly string[] | null) => {
    if (paragraphs) {
      parts.push({ key, render: (tone) => <NarrativeSection id={key} heading={heading} paragraphs={paragraphs} tone={tone} /> });
    }
  };
  narrative('challenge', headings.challenge, view.challenge);
  narrative('approach', headings.approach, view.approach);
  narrative('build', headings.build, view.build);
  if (view.gallery.length > 0) parts.push({ key: 'gallery', render: (tone) => <GallerySection view={view} tone={tone} /> });
  if (view.beforeAfter) parts.push({ key: 'before-after', ink: true, render: () => <CaseStudyBeforeAfter view={view} /> });
  if (view.outcome) {
    const outcome = view.outcome;
    parts.push({
      key: 'outcome',
      render: (tone) => (
        <NarrativeSection id="outcome" heading={headings.outcome} paragraphs={outcome} tone={tone}>
          <MeasurementNote label={labels.measurement}>{view.measurement}</MeasurementNote>
        </NarrativeSection>
      ),
    });
  }
  if (hasClientWords(view)) parts.push({ key: 'quote', render: (tone) => <QuoteSection view={view} tone={tone} /> });
  if (view.relatedServices.length > 0) {
    parts.push({ key: 'related-services', render: (tone) => <RelatedServices view={view} tone={tone} /> });
  }
  if (view.relatedCaseStudies.length > 0) {
    parts.push({ key: 'related-case-studies', render: (tone) => <RelatedCaseStudies view={view} tone={tone} /> });
  }
  return parts;
}

/** `/work/<slug>/`: a published case study (docs/03-page-specs.md). */
export default async function CaseStudyPage({ params }: PageProps<'/work/[slug]'>) {
  const { slug } = await params;
  const view = await getCaseStudy(slug);
  if (!view) notFound();
  const path = caseStudyPath(view.slug);

  const structuredData: JsonLdObject[] = [
    caseStudyArticleJsonLd({
      headline: view.title,
      description: view.seo.description,
      path,
      image: view.cover?.src ?? view.seo.ogImage,
      datePublished: view.publishedAt,
      dateModified: view.updatedAt,
      about: view.atAGlance.services.map((service) => service.name),
    }),
  ];
  if (view.quote) structuredData.push(caseStudyReviewJsonLd(view.quote, path));

  return (
    <>
      <PageHero
        crumbs={[
          { name: 'Case studies', path: SITE_ROUTES.work },
          { name: view.clientName, path },
        ]}
        eyebrow={view.eyebrow}
        title={view.title}
        answer={view.answerBlock}
        aside={<CaseStudyHeadline view={view} />}
      />
      {withTones(caseStudyParts(view))}
      <JsonLd data={structuredData} />
    </>
  );
}
