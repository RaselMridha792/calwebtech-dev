import { insightsOgImagePath, type InsightsArticleView } from '@calwebtech/shared';
import { organizationId, type JsonLdObject } from '@/lib/seo/json-ld';
import { absoluteUrl } from '@/lib/seo/site';

const CONTEXT = 'https://schema.org';

/**
 * Article with its author as a Person, the dates and the word count
 * (docs/04-seo-keyword-map.md, "Schema per template"). BreadcrumbList comes from the
 * page hero's breadcrumbs, and the Organization node from the site layout.
 */
export function articleJsonLd({ view, path }: { view: InsightsArticleView; path: string }): JsonLdObject {
  const url = absoluteUrl(path);
  const author = view.author;
  const image = view.cover?.src ?? insightsOgImagePath(view.slug);
  return {
    '@context': CONTEXT,
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: view.title,
    description: view.seo.description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: view.publishedAt,
    dateModified: view.updatedAt,
    image: [absoluteUrl(image)],
    wordCount: view.wordCount,
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    ...(view.category ? { articleSection: view.category.name } : {}),
    author: author
      ? {
          '@type': 'Person',
          name: author.name,
          jobTitle: author.role,
          worksFor: { '@id': organizationId() },
          ...(author.bio ? { description: author.bio } : {}),
          ...(author.photo ? { image: absoluteUrl(author.photo.src) } : {}),
          ...(author.credentials.length > 0 ? { knowsAbout: [...author.credentials] } : {}),
        }
      : { '@id': organizationId() },
    publisher: { '@id': organizationId() },
  };
}
