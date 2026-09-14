import { serializeJsonLd, type JsonLdObject } from '@/lib/seo/json-ld';

/**
 * Structured data for the page (docs/04-seo-keyword-map.md, "Schema per template"). Build
 * the object with the helpers in lib/seo/json-ld.ts; the serialiser escapes record text so
 * it cannot close the script element.
 */
export function JsonLd({ data }: { data: JsonLdObject | readonly JsonLdObject[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
