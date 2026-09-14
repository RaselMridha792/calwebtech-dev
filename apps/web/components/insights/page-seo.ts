import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, type PageSeo } from '@calwebtech/shared';
import { clampText, seoTitle } from '@/lib/seo/metadata';

const BRAND_SUFFIX = ' | Calwebtech';

/**
 * Titles and descriptions for the pages of a listing. Page two onwards is an indexable page
 * of its own, so it says which page it is rather than repeating the first page's metadata.
 */
export function listingPageSeo(seo: PageSeo, page: number): { title: string; description: string } {
  if (page <= 1) return { title: seo.title, description: seo.description };
  const titleSuffix = `, page ${String(page)}`;
  const descriptionSuffix = ` Page ${String(page)}.`;
  return {
    title: `${clampText(seo.title, Math.max(20, SEO_TITLE_MAX - titleSuffix.length - BRAND_SUFFIX.length), false)}${titleSuffix}`,
    description: `${clampText(seo.description, SEO_DESCRIPTION_MAX - descriptionSuffix.length, false)}${descriptionSuffix}`,
  };
}

/** The document title as the page will render it, for tests and length checks. */
export const listingDocumentTitle = (seo: PageSeo, page: number): string => seoTitle(listingPageSeo(seo, page).title);
