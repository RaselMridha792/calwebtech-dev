import 'server-only';
import {
  landingPageViewSchema,
  validationErrorResponseSchema,
  type LandingPageView,
  type LeadSubmission,
} from '@calwebtech/shared';
import { z } from 'zod';

const apiEnvSchema = z.object({ API_INTERNAL_URL: z.url() });

function apiUrl(path: string): string {
  const { API_INTERNAL_URL } = apiEnvSchema.parse(process.env);
  return `${API_INTERNAL_URL.replace(/\/$/, '')}${path}`;
}

export const landingPageTag = (slug: string) => `landing-page:${slug}`;

/** Time-based fallback. Publishing from the dashboard revalidates the tag immediately. */
export const LANDING_PAGE_REVALIDATE_SECONDS = 300;

export async function getLandingPage(slug: string): Promise<LandingPageView | null> {
  const response = await fetch(apiUrl(`/landing-pages/${encodeURIComponent(slug)}`), {
    next: { revalidate: LANDING_PAGE_REVALIDATE_SECONDS, tags: [landingPageTag(slug)] },
  });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) {
    throw new Error(`API responded ${response.status} for landing page "${slug}"`);
  }
  return landingPageViewSchema.parse(await response.json());
}

export type LeadPostResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; fieldErrors: Record<string, string[]> }
  | { ok: false; reason: 'rate_limited' | 'unavailable' };

export async function postLead(
  submission: LeadSubmission,
  visitorIp: string | null,
): Promise<LeadPostResult> {
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
  if (response.status === 400) {
    const body = validationErrorResponseSchema.safeParse(await response.json());
    if (body.success) return { ok: false, reason: 'invalid', fieldErrors: body.data.fieldErrors };
  }
  return { ok: false, reason: 'unavailable' };
}
