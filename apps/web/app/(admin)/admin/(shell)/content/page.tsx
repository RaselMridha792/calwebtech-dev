import { CONTENT_STATUS_LABELS, adminServiceListSchema, type ContentStatus } from '@calwebtech/shared';
import Link from 'next/link';
import { ChevronRightIcon, PlusIcon } from '@/components/admin/icons';
import { AdminPage, EmptyState, PageHeader, Panel } from '@/components/admin/ui/page';
import { LIST, LIST_ROW, MUTED, PILL, TAG, button } from '@/components/admin/ui/styles';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * The content manager (docs/12-admin-dashboard.md, module 6).
 *
 * Services first, because it is the family the owner asked for and the one whose template
 * renders a complete page from four fields. The other types reuse this listing, this
 * editor and the same publishing panel as they move across.
 */
export default async function AdminContentPage() {
  const user = await requireModule('content', 'read');
  const list = await adminGet('/admin/services', adminServiceListSchema);
  const mayWrite = user.modules.includes('content') && user.role !== 'VIEWER';

  const newService = mayWrite ? (
    <Link href="/admin/content/services/new/" className={button('primary')}>
      <PlusIcon className="size-4" />
      New service
    </Link>
  ) : null;

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Content"
        title="Services"
        count={list.items.length}
        description="The service pages on the site. Edit one and publish, and the page changes for visitors — no developer needed."
        actions={newService}
      />

      {list.items.length === 0 ? (
        <Panel flush>
          <EmptyState title="No services yet" actions={newService}>
            The services on the site still come from its built-in copy. Add one here and it publishes at its own
            address without disturbing the rest.
          </EmptyState>
        </Panel>
      ) : (
        <ul className={LIST}>
          {list.items.map((service) => (
            <li key={service.id} className={LIST_ROW}>
              <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
                <Link
                  href={`/admin/content/services/${service.id}/`}
                  className="text-[14.5px] font-semibold text-ink-invert before:absolute before:inset-0"
                >
                  {service.title}
                </Link>
                <p className={MUTED}>
                  /services/{service.slug}/ · {service.category?.name ?? 'No category'} · Order {service.order}
                </p>
              </div>
              {service.shadowsSnapshot ? <span className={TAG}>Snapshot still serving this address</span> : null}
              <StatusPill status={service.status} />
              <span className="text-[12.5px] text-admin-muted tabular-nums sm:w-24 sm:text-right">{when(service.updatedAt)}</span>
              <ChevronRightIcon className="size-4 shrink-0 text-admin-muted max-sm:hidden" />
            </li>
          ))}
        </ul>
      )}

      <p className={MUTED}>
        Industries and case studies have their own screens. Articles, locations and the glossary still come from the
        site&apos;s built-in copy and move across one at a time.
      </p>
    </AdminPage>
  );
}

/** Teal is a round affirmative mark and nothing else, so only a published page gets it. */
const DOT: Record<ContentStatus, string> = {
  PUBLISHED: 'rounded-full bg-result',
  SCHEDULED: 'rounded-full bg-gold-500',
  DRAFT: 'rounded-full bg-admin-surface ring-2 ring-admin-muted ring-inset',
  ARCHIVED: 'rounded-full bg-admin-muted',
};

function StatusPill({ status }: { status: ContentStatus }) {
  return (
    <span className={`${PILL} pl-2`}>
      <span aria-hidden className={`size-2 shrink-0 ${DOT[status]}`} />
      {CONTENT_STATUS_LABELS[status]}
    </span>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
