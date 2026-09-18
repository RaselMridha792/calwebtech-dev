import freeWebsiteAudit from './free-website-audit.json';
import startAProject from './start-a-project.json';

/*
 * Snapshots of the forms family's API responses (docs/10-site-pages.md), which the pages
 * render while API_INTERNAL_URL is unset. Each file is exactly what its endpoint returns.
 */

export const formsProjectSnapshot: unknown = startAProject;
export const formsAuditSnapshot: unknown = freeWebsiteAudit;
