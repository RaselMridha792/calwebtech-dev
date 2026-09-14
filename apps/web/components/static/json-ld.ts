import { absoluteUrl } from '@/lib/seo/site';
import { organizationId, type JsonLdObject } from '@/lib/seo/json-ld';

/** The contact page as a ContactPage about the company (the layout renders the Organization node). */
export function contactPageJsonLd(input: { name: string; description: string; path: string }): JsonLdObject {
  const url = absoluteUrl(input.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    '@id': `${url}#webpage`,
    url,
    name: input.name,
    description: input.description,
    about: { '@id': organizationId() },
  };
}
