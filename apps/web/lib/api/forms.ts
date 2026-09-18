import 'server-only';
import {
  FORMS_ROUTES,
  formsAuditViewSchema,
  formsProjectDraftResultSchema,
  formsProjectViewSchema,
  type FormsProjectDraft,
  type FormsProjectDraftResult,
} from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import { formsAuditSnapshot, formsProjectSnapshot } from '@/static-content/forms';
import { apiUrl, getView, hasApi } from './core';

/*
 * The forms family (docs/10-site-pages.md): `/start-a-project/` and `/free-website-audit/`.
 * Without API_INTERNAL_URL each getter returns its snapshot from static-content/forms,
 * validated by the same schema, and nothing can be stored: the draft save says so rather
 * than telling the visitor their brief is safe.
 */

export const getFormsProjectPage = cache(() =>
  getView('/pages/start-a-project', formsProjectViewSchema, formsProjectSnapshot),
);

export const getFormsAuditPage = cache(() =>
  getView('/pages/free-website-audit', formsAuditViewSchema, formsAuditSnapshot),
);

/** Nothing was stored: no API, or it could not be reached. The page never claims otherwise. */
const NOT_SAVED: FormsProjectDraftResult = { status: 'saved', draft: null };

/**
 * Stores the brief at the step the visitor has reached. Failures are quiet on purpose: a
 * draft is a convenience, and a visitor filling a form in is not told about our plumbing.
 * The final submit reports honestly whether the lead was stored.
 */
export async function postProjectDraft(
  draft: FormsProjectDraft,
  visitorIp: string | null,
): Promise<FormsProjectDraftResult> {
  if (!hasApi()) return NOT_SAVED;
  try {
    const response = await fetch(apiUrl('/forms/project-draft'), {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        ...(visitorIp ? { 'x-forwarded-for': visitorIp } : {}),
      },
      body: JSON.stringify(draft),
    });
    if (response.status !== 202) return NOT_SAVED;
    return formsProjectDraftResultSchema.parse(await response.json());
  } catch {
    return NOT_SAVED;
  }
}

/** Both pages exist whatever is published, so the list needs no call. */
export function sitemapEntries(): Promise<SitemapEntry[]> {
  return Promise.resolve([
    { path: FORMS_ROUTES.startProject, title: 'Start a project', section: 'Plan a project' },
    { path: FORMS_ROUTES.freeWebsiteAudit, title: 'Free website audit', section: 'Plan a project' },
  ]);
}
