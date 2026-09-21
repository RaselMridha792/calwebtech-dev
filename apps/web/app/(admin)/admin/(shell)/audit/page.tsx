import { adminAuditListSchema, adminAuditQuerySchema, type AdminAuditEntry, type AdminAuditQuery } from '@calwebtech/shared';
import Link from 'next/link';
import { AutoSubmit } from '@/components/admin/leads/auto-submit';
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

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-4">
        <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Audit log</h1>
        <p className="mt-0.5 text-[12.5px] text-admin-body">
          {list.total} {list.total === 1 ? 'entry' : 'entries'} · every sign-in, pipeline change, note, setting and
          export
        </p>
      </div>

      <form
        role="search"
        method="get"
        action="/admin/audit/"
        className="mt-3 flex shrink-0 flex-wrap items-end gap-2.5 border-y border-admin-line bg-admin-surface px-4 py-2.5"
      >
        <AutoSubmit />
        <Select label="Who" name="userId" value={query.userId ?? ''} width="w-[160px]" placeholder="Anyone">
          {list.actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name}
            </option>
          ))}
        </Select>
        <Select label="Action" name="action" value={query.action ?? ''} width="w-[190px]" placeholder="Any action">
          {list.actions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </Select>
        <Select label="Record" name="entityType" value={query.entityType ?? ''} width="w-[140px]" placeholder="Any record">
          {list.entityTypes.map((entity) => (
            <option key={entity} value={entity}>
              {entity}
            </option>
          ))}
        </Select>
        <DateField label="From" name="from" value={query.from ?? ''} />
        <DateField label="To" name="to" value={query.to ?? ''} />
        <button type="submit" className="sr-only">
          Apply filters
        </button>
        <Link href="/admin/audit/" className="h-[30px] self-end text-[12.5px] font-semibold text-admin-link hover:underline">
          Clear all
        </Link>
      </form>

      <div className="min-h-0 flex-1 overflow-auto bg-admin-surface">
        {list.items.length === 0 ? (
          <p className="px-4 py-16 text-center text-[13px] text-admin-body">
            Nothing matches these filters.
          </p>
        ) : (
          <ul>
            {list.items.map((entry) => (
              <Entry key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 bg-admin-surface px-4 py-2">
        <p className="text-[12px] text-admin-body tabular-nums">
          Page {list.page} of {pages}
        </p>
        <div className="flex gap-2">
          <Page href={pageUrl(query, list.page - 1)} disabled={list.page <= 1}>
            Previous
          </Page>
          <Page href={pageUrl(query, list.page + 1)} disabled={list.page >= pages}>
            Next
          </Page>
        </div>
      </div>
    </main>
  );
}

function Entry({ entry }: { entry: AdminAuditEntry }) {
  const changed = entry.before !== null || entry.after !== null;
  return (
    <li className="border-b border-admin-mist px-4 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[12.5px] font-semibold text-admin-ink">{entry.action}</span>
        <span className="text-[11.5px] text-admin-body">
          {entry.actor ? entry.actor.name : 'no signed-in user'} · {entry.entityType}
          {entry.entityId ? ` ${entry.entityId}` : ''}
        </span>
        <span className="ml-auto text-[11px] text-admin-muted tabular-nums">
          {new Date(entry.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' })}
          {entry.ip ? ` · ${entry.ip}` : ''}
        </span>
      </div>
      {changed ? (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[11.5px] text-admin-link">What changed</summary>
          <div className="mt-1.5 flex flex-wrap gap-2.5">
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
    <div className="min-w-[220px] flex-1">
      <p className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">{label}</p>
      <pre className="mt-1 overflow-auto rounded-[4px] bg-admin-sunken px-2 py-1.5 text-[11.5px] whitespace-pre-wrap text-admin-body">
        {value === null || value === undefined ? '—' : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function Select({
  label,
  name,
  value,
  width,
  placeholder,
  children,
}: {
  label: string;
  name: string;
  value: string;
  width: string;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-[3px] ${width}`}>
      <label htmlFor={`audit-${name}`} className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
        {label}
      </label>
      <select
        id={`audit-${name}`}
        name={name}
        defaultValue={value}
        className={`${CONTROL} ${value ? 'border-admin-edge' : ''}`}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
    </div>
  );
}

function DateField({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <div className="flex w-[140px] flex-col gap-[3px]">
      <label htmlFor={`audit-${name}`} className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
        {label}
      </label>
      <input
        id={`audit-${name}`}
        name={name}
        type="date"
        defaultValue={value}
        className={`${CONTROL} ${value ? 'border-admin-edge' : ''}`}
      />
    </div>
  );
}

const CONTROL =
  'h-[30px] w-full rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus';

function Page({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const style = 'flex h-7 items-center rounded-[4px] border border-admin-line px-2.5 text-[12px] font-semibold';
  if (disabled) {
    return (
      <span aria-disabled className={`${style} text-admin-muted opacity-40`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={`${style} text-admin-body hover:border-admin-focus hover:text-admin-ink`}>
      {children}
    </Link>
  );
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
