import { GLOSSARY_ROUTE, glossaryTermPath, type GlossaryTermCard } from '@calwebtech/shared';
import { organizationId, type JsonLdObject } from '@/lib/seo/json-ld';
import { absoluteUrl } from '@/lib/seo/site';

const CONTEXT = 'https://schema.org';

/** Google shows at most 110 characters of an Article headline. */
const HEADLINE_MAX = 110;

/** The id of the glossary as one DefinedTermSet, which every term belongs to. */
export const definedTermSetId = (): string => `${absoluteUrl(GLOSSARY_ROUTE)}#glossary`;

export interface GuideArticleInput {
  headline: string;
  description: string;
  path: string;
  image: string | null;
  /** The record's last change, when it has one. */
  dateModified: string | null;
  /** What the guide is about: the service it belongs to and the terms it defines. */
  about?: readonly string[];
}

/**
 * A guide as an Article the company published (docs/04-seo-keyword-map.md, Schema per
 * template). The ungated summary is the page, so the Article describes that page rather
 * than the file behind the gate.
 */
export function guideArticleJsonLd(input: GuideArticleInput): JsonLdObject {
  const url = absoluteUrl(input.path);
  const headline =
    input.headline.length > HEADLINE_MAX ? `${input.headline.slice(0, HEADLINE_MAX - 1).trimEnd()}…` : input.headline;
  return {
    '@context': CONTEXT,
    '@type': 'Article',
    '@id': `${url}#article`,
    headline,
    description: input.description,
    url,
    mainEntityOfPage: url,
    ...(input.image ? { image: [absoluteUrl(input.image)] } : {}),
    ...(input.dateModified ? { datePublished: input.dateModified, dateModified: input.dateModified } : {}),
    author: { '@id': organizationId() },
    publisher: { '@id': organizationId() },
    ...(input.about && input.about.length > 0
      ? { about: input.about.map((name) => ({ '@type': 'Thing', name })) }
      : {}),
  };
}

/** The glossary index as a DefinedTermSet holding every published term. */
export function definedTermSetJsonLd(input: {
  name: string;
  description: string;
  terms: readonly GlossaryTermCard[];
}): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'DefinedTermSet',
    '@id': definedTermSetId(),
    name: input.name,
    description: input.description,
    url: absoluteUrl(GLOSSARY_ROUTE),
    publisher: { '@id': organizationId() },
    hasDefinedTerm: input.terms.map((term) => ({
      '@type': 'DefinedTerm',
      '@id': `${absoluteUrl(glossaryTermPath(term.slug))}#term`,
      name: term.term,
      description: term.definition,
      url: absoluteUrl(glossaryTermPath(term.slug)),
      inDefinedTermSet: { '@id': definedTermSetId() },
    })),
  };
}

/** One term as a DefinedTerm inside the glossary's DefinedTermSet. */
export function definedTermJsonLd(input: { term: string; definition: string; slug: string }): JsonLdObject {
  const url = absoluteUrl(glossaryTermPath(input.slug));
  return {
    '@context': CONTEXT,
    '@type': 'DefinedTerm',
    '@id': `${url}#term`,
    name: input.term,
    description: input.definition,
    url,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      '@id': definedTermSetId(),
      name: 'Calwebtech website glossary',
      url: absoluteUrl(GLOSSARY_ROUTE),
    },
  };
}
