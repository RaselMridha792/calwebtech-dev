import { ADMIN_LEADS_PAGE_SIZE, type AdminLeadQuery } from '@calwebtech/shared';

/**
 * The inbox's whole state is its URL, so every control is a link or a GET form and the
 * table never has to hydrate. This builds one URL from the current query plus what the
 * control is changing.
 *
 * Defaults are left out, so a plain `/admin/leads/` is the unfiltered view and a shared
 * link carries only what was actually chosen.
 */
export function leadsUrl(query: AdminLeadQuery, changes: Partial<AdminLeadQuery> = {}): string {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();

  for (const value of next.type ?? []) params.append('type', value);
  for (const value of next.status ?? []) params.append('status', value);
  if (next.owner) params.set('owner', next.owner);
  if (next.search) params.set('search', next.search);
  if (next.received && next.received !== 'last-90-days') params.set('received', next.received);
  if (next.from) params.set('from', next.from);
  if (next.to) params.set('to', next.to);
  if (next.source) params.set('source', next.source);
  if (next.serviceSlug) params.set('serviceSlug', next.serviceSlug);
  if (next.campaignSlug) params.set('campaignSlug', next.campaignSlug);
  if (next.enquiry) params.set('enquiry', next.enquiry);
  if (next.brief) params.set('brief', next.brief);
  if (next.includeClosed) params.set('includeClosed', 'true');
  if (next.sort !== 'received') params.set('sort', next.sort);
  if (next.dir !== 'desc') params.set('dir', next.dir);
  if (next.page > 1) params.set('page', String(next.page));
  if (next.pageSize !== ADMIN_LEADS_PAGE_SIZE) params.set('pageSize', String(next.pageSize));

  const search = params.toString();
  return search ? `/admin/leads/?${search}` : '/admin/leads/';
}

/**
 * The same view with one lead opened. The panel is a URL, not component state, so it
 * survives a reload and can be linked to.
 */
export function leadPanelUrl(query: AdminLeadQuery, leadId: string | null): string {
  const base = leadsUrl(query);
  if (!leadId) return base;
  return base.includes('?') ? `${base}&lead=${encodeURIComponent(leadId)}` : `${base}?lead=${encodeURIComponent(leadId)}`;
}

/** Clicking a column: a new column starts descending, the current one flips. */
export function sortUrl(query: AdminLeadQuery, column: AdminLeadQuery['sort']): string {
  const dir = query.sort === column && query.dir === 'desc' ? 'asc' : 'desc';
  return leadsUrl(query, { sort: column, dir, page: 1 });
}
