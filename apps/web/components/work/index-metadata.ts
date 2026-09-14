import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX } from '@calwebtech/shared';
import { clampText } from '@/lib/seo/metadata';

/**
 * The title and description of a page of `/work/` results. Pages past the first are
 * indexable with a canonical of their own, so each carries its page number in both, and
 * the base copy is shortened first so the limits can never cut the number off.
 */
export function workIndexPageSeo(seo: { title: string; description: string }, page: number) {
  if (page <= 1) return { title: seo.title, description: seo.description };

  const titleSuffix = `, page ${String(page)}`;
  const title = `${clampText(seo.title, SEO_TITLE_MAX - titleSuffix.length, false)}${titleSuffix}`;

  const descriptionSuffix = ` Page ${String(page)}.`;
  // One character is kept for the full stop added when the base copy ends without one.
  const base = clampText(seo.description, SEO_DESCRIPTION_MAX - descriptionSuffix.length - 1);
  const description = `${/[.!?…]$/u.test(base) ? base : `${base}.`}${descriptionSuffix}`;

  return { title, description };
}
