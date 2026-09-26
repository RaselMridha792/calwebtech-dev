/**
 * What "published" means for public views (docs/10-site-pages.md):
 *
 * - models with `publishedAt` (Service, Post, LandingPage): PUBLISHED, or SCHEDULED with a
 *   publish time that has passed. Use `publishedAsOf(now)`.
 * - models with only `status` (Industry, Project, Location, GlossaryTerm, Guide, Demo,
 *   JobOpening): `{ status: 'PUBLISHED' }`.
 * - add `deletedAt: null` wherever the model has `deletedAt` (Service, Project, LandingPage).
 * - testimonials appear only with `consentAt: { not: null }` and `deletedAt: null` (`CONSENTED`).
 */
export function publishedAsOf(now: Date) {
  return {
    OR: [{ status: 'PUBLISHED' as const }, { status: 'SCHEDULED' as const, publishedAt: { lte: now } }],
  };
}

/**
 * Testimonials may be shown only once the client has agreed to publication, and never once
 * removed in the dashboard, which keeps the row (docs/08-decisions.md, 70).
 */
export const CONSENTED = { consentAt: { not: null }, deletedAt: null };
