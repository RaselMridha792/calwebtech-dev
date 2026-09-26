import { adminAuditListSchema, adminAuditQuerySchema, type AdminAuditEntry, type AdminAuditQuery } from '@calwebtech/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuditIcon, ChevronRightIcon } from '@/components/admin/icons';
import { AutoSubmit } from '@/components/admin/leads/auto-submit';
import { AdminPage, EmptyState, PageHeader } from '@/components/admin/ui/page';
import { CARD, KICKER, LINK, TAG, button } from '@/components/admin/ui/styles';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * The audit log (docs/12-admin-dashboard.md, module 12).
 *
 * Entirely server-rendered: the filters are a GET form and the diffs are `<details>`, so
 * the screen costs no client JavaScript at all. It is also read-only by construction —
 * there is no route here that could change an entry.
 */
export default async function AdminAuditPage({ searchParams }: PageProps<'/admin/audit'>) {
  await requireModule('auditLog', 'read');
  const params = await searchParams;
  const query = adminAuditQuerySchema.parse(params);
  const list = await adminGet(`/admin/audit?${toSearch(query)}`, adminAuditListSchema);

  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const first = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const last = Math.min(list.total, list.page * list.pageSize);
  const narrowed = Boolean(query.userId || query.action || query.entityType || query.from || query.to);

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Admin"
        title="Audit log"
        count={list.total}
        description="A record of everything done in this dashboard — every sign-in, change to a lead, note, setting and export — with who did it and when. Nothing here can be edited."
      />

      <form role="search" method="get" action="/admin/audit/" className="flex flex-wrap items-center gap-2">
        <AutoSubmit />
        <Pick label="Who" name="userId" value={query.userId ?? ''} placeholder="Anyone">
          {list.actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name}
            </option>
          ))}
        </Pick>
        <Pick label="Action" name="action" value={query.action ?? ''} placeholder="Any action">
          {list.actions.map((action) => (
            <option key={action} value={action}>
              {actionLabel(action)}
            </option>
          ))}
        </Pick>
        <Pick label="Record" name="entityType" value={query.entityType ?? ''} placeholder="Any record">
          {list.entityTypes.map((entity) => (
            <option key={entity} value={entity}>
              {entity}
            </option>
          ))}
        </Pick>
        <DatePick label="From" name="from" value={query.from ?? ''} />
        <DatePick label="To" name="to" value={query.to ?? ''} />
        {/* Reachable by keyboard and the only way to apply the filters without JavaScript. */}
        <button type="submit" className="sr-only focus:not-sr-only focus:rounded-lg focus:px-3 focus:py-2 focus:text-ink-invert">
          Apply filters
        </button>
        {narrowed ? (
          <Link href="/admin/audit/" className={`${LINK} ml-1 text-[13.5px]`}>
            Clear all
          </Link>
        ) : null}
      </form>

      <div className={`${CARD} overflow-hidden`}>
        {list.items.length === 0 ? (
          <EmptyState
            icon={<AuditIcon className="size-5" />}
            title={narrowed ? 'Nothing matches these filters' : 'Nothing recorded yet'}
            actions={
              narrowed ? (
                <Link href="/admin/audit/" className={button('secondary')}>
                  Clear filters
                </Link>
              ) : undefined
            }
          >
            {narrowed
              ? 'Widen the dates or clear a filter to see more of the log.'
              : 'Entries appear here as soon as anyone signs in or changes something.'}
          </EmptyState>
        ) : (
          <ol className="divide-y divide-admin-line2">
            {list.items.map((entry) => (
              <Entry key={entry.id} entry={entry} />
            ))}
          </ol>
        )}

        <nav
          aria-label="Pages"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-admin-line2 px-4 py-3 sm:px-5"
        >
          <p className="text-[13px] text-ink-invert-muted tabular-nums">
            Showing {first}–{last} of {list.total}
          </p>
          <div className="flex items-center gap-2">
            <Page href={pageUrl(query, list.page - 1)} disabled={list.page <= 1}>
              Previous
            </Page>
            <span className="px-1 text-[13px] text-ink-invert-muted tabular-nums">
              Page {list.page} of {pages}
            </span>
            <Page href={pageUrl(query, list.page + 1)} disabled={list.page >= pages}>
              Next
            </Page>
          </div>
        </nav>
      </div>
    </AdminPage>
  );
}

/**
 * Who made the change: the signed-in user, or, for a change made on the server's command
 * line, the tool that made it (`via`, which `admin-cli` and `settings-cli` record; decision 68).
 */
function actorLabel(entry: AdminAuditEntry): string {
  if (entry.actor) return entry.actor.name;
  const after = entry.after;
  const via = typeof after === 'object' && after !== null && 'via' in after ? after.via : null;
  return typeof via === 'string' ? `Command line (${via})` : 'No signed-in user';
}

function Entry({ entry }: { entry: AdminAuditEntry }) {
  const changed = entry.before !== null || entry.after !== null;
  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={TAG}>{actionLabel(entry.action)}</span>
        <span className="text-[14px] font-semibold text-ink-invert">{actorLabel(entry)}</span>
        <span className="min-w-0 text-[13.5px] text-ink-invert-muted">
          {entry.entityType}
          {entry.entityId ? (
            <span className="ml-1.5 font-mono text-[12px] break-all text-admin-muted">{entry.entityId}</span>
          ) : null}
        </span>
        <span className="ml-auto text-[12.5px] whitespace-nowrap text-admin-muted tabular-nums">
          {when(entry.createdAt)}
          {entry.ip ? ` · ${entry.ip}` : ''}
        </span>
      </div>
      {changed ? (
        <details className="group mt-2">
          <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-md pr-2 text-[13px] font-semibold text-admin-link transition-colors duration-150 hover:text-ink-invert [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" />
            What changed
          </summary>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Side label="Before" value={entry.before} />
            <Side label="After" value={entry.after} />
          </div>
        </details>
      ) : null}
    </li>
  );
}

function Side({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className={KICKER}>{label}</p>
      <pre className="max-h-[360px] overflow-auto rounded-lg border border-admin-line2 bg-admin-sunken px-3 py-2.5 font-mono text-[12.5px] leading-[1.55] break-words whitespace-pre-wrap text-ink-invert-muted">
        {value === null || value === undefined ? '—' : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/**
 * A select with its label inside the same pill, as the inbox's filter bar draws them, so
 * the row reads as a sentence of choices ("Who: Anyone"). A lit pill is one that narrows
 * the view.
 */
function Pick({
  label,
  name,
  value,
  placeholder,
  children,
}: {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  children: ReactNode;
}) {
  return (
    <div className={pill(Boolean(value))}>
      <label htmlFor={`audit-${name}`} className="pl-3 text-[13px] text-admin-muted">
        {label}
      </label>
      <select
        id={`audit-${name}`}
        name={name}
        defaultValue={value}
        className="h-full max-w-[200px] cursor-pointer truncate rounded-lg bg-transparent pr-2 pl-1.5 text-[13.5px] font-semibold text-ink-invert outline-none focus-visible:outline-none"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
    </div>
  );
}

function DatePick({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <div className={pill(Boolean(value))}>
      <label htmlFor={`audit-${name}`} className="pl-3 text-[13px] text-admin-muted">
        {label}
      </label>
      <input
        id={`audit-${name}`}
        name={name}
        type="date"
        defaultValue={value}
        className="h-full rounded-lg bg-transparent pr-2 pl-1.5 text-[13.5px] font-semibold text-ink-invert outline-none scheme-dark focus-visible:outline-none"
      />
    </div>
  );
}

function pill(lit: boolean): string {
  return `flex h-10 items-center rounded-lg border transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-admin-focus pointer-coarse:h-11 ${
    lit ? 'border-admin-edge bg-admin-nav' : 'border-admin-line hover:border-admin-edge'
  }`;
}

function Page({ href, disabled, children }: { href: string; disabled: boolean; children: ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled className={button('secondary', 'sm')}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={button('secondary', 'sm')}>
      {children}
    </Link>
  );
}

/** "page_copy.updated" as a person would say it: "Page copy updated". The filter value is unchanged. */
function actionLabel(action: string): string {
  const words = action.replace(/[._]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  });
}

function toSearch(query: AdminAuditQuery): string {
  const params = new URLSearchParams();
  if (query.userId) params.set('userId', query.userId);
  if (query.action) params.set('action', query.action);
  if (query.entityType) params.set('entityType', query.entityType);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.page > 1) params.set('page', String(query.page));
  return params.toString();
}

function pageUrl(query: AdminAuditQuery, page: number): string {
  const search = toSearch({ ...query, page });
  return search ? `/admin/audit/?${search}` : '/admin/audit/';
}
