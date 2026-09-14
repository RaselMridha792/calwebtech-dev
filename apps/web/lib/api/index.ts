import 'server-only';
import {
  botCheckFailedResponseSchema,
  homePageViewSchema,
  landingPageViewSchema,
  validationErrorResponseSchema,
  type HomePageView,
  type LandingPageView,
  type LeadSubmission,
} from '@calwebtech/shared';
import { cache } from 'react';
import staticHome from '@/static-content/home.json';
import staticLanding from '@/static-content/landing-b2b-website-design.json';
import { apiUrl, getView, hasApi } from './core';

/*
 * The homepage, campaign landing pages and lead submissions. Site page families keep
 * their getters in their own module beside this one (lib/api/<family>.ts), built on
 * getView and findView from ./core (docs/10-site-pages.md).
 */

export const landingPageTag = (slug: string) => `landing-page:${slug}`;

/** Time-based fallback. Publishing from the dashboard revalidates the tag immediately. */
export const LANDING_PAGE_REVALIDATE_SECONDS = 300;

export async function getLandingPage(slug: string): Promise<LandingPageView | null> {
  if (!hasApi()) {
    const page = landingPageViewSchema.parse(staticLanding);
    return page.slug === slug ? page : null;
  }
  const response = await fetch(apiUrl(`/landing-pages/${encodeURIComponent(slug)}`), {
    next: { revalidate: LANDING_PAGE_REVALIDATE_SECONDS, tags: [landingPageTag(slug)] },
  });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) {
    throw new Error(`API responded ${response.status} for landing page "${slug}"`);
  }
  return landingPageViewSchema.parse(await response.json());
}

/**
 * The homepage's copy and published proof. The page renders per request, so this is
 * deduplicated within a request (metadata and page share one call) and never cached
 * across requests: a changed setting, such as homepage.indexing, applies at once.
 */
export const getHomePage = cache(
  (): Promise<HomePageView> => getView('/pages/home', homePageViewSchema, staticHome),
);

export type LeadPostResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; fieldErrors: Record<string, string[]> }
  | { ok: false; reason: 'rate_limited' | 'unavailable' | 'bot_check_failed' };

export async function postLead(
  submission: LeadSubmission,
  visitorIp: string | null,
): Promise<LeadPostResult> {
  // Without the API nothing can store the lead, so the form says it could not send.
  if (!hasApi()) return { ok: false, reason: 'unavailable' };
  let response: Response;
  try {
    response = await fetch(apiUrl('/leads'), {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        ...(visitorIp ? { 'x-forwarded-for': visitorIp } : {}),
      },
      body: JSON.stringify(submission),
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (response.status === 202) return { ok: true };
  if (response.status === 429) return { ok: false, reason: 'rate_limited' };
  if (response.status === 403) {
    const body = botCheckFailedResponseSchema.safeParse(await response.json().catch(() => null));
    if (body.success) return { ok: false, reason: 'bot_check_failed' };
  }
  if (response.status === 400) {
    const body = validationErrorResponseSchema.safeParse(await response.json());
    if (body.success) return { ok: false, reason: 'invalid', fieldErrors: body.data.fieldErrors };
  }
  return { ok: false, reason: 'unavailable' };
}
