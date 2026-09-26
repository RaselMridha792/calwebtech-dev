import { CONTENT_STATUS_LABELS, adminIndustryListSchema, type ContentStatus } from '@calwebtech/shared';
import Link from 'next/link';
import { ChevronRightIcon, PlusIcon } from '@/components/admin/icons';
import { AdminPage, EmptyState, PageHeader, Panel } from '@/components/admin/ui/page';
import { LIST, LIST_ROW, MUTED, PILL, TAG, button } from '@/components/admin/ui/styles';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * Industries in the content manager (docs/14-remaining-work.md, task 4). The same listing as
 * services: a row per industry with its address, status and whether the committed snapshot
 * still serves that address.
 */
export default async function AdminIndustriesPage() {
  const user = await requireModule('content', 'read');
  const list = await adminGet('/admin/industries', adminIndustryListSchema);
  const mayWrite = user.modules.includes('content') && user.role !== 'VIEWER';

  const newIndustry = mayWrite ? (
    <Link href="/admin/industries/new/" className={button('primary')}>
      <PlusIcon className="size-4" />
      New industry
    </Link>
  ) : null;

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Content"
        title="Industries"
        count={list.items.length}
        description="The industry pages on the site, one for each kind of business you serve. Edit one and publish, and the page changes for visitors — no developer needed."
        actions={newIndustry}
      />

      {list.items.length === 0 ? (
        <Panel flush>
          <EmptyState title="No industries yet" actions={newIndustry}>
            The industries on the site still come from its built-in copy until they are brought in. Add one here and
            it publishes at its own address.
          </EmptyState>
        </Panel>
      ) : (
        <ul className={LIST}>
          {list.items.map((industry) => (
            <li key={industry.id} className={LIST_ROW}>
              <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
                <Link
                  href={`/admin/industries/${industry.id}/`}
                  className="text-[14.5px] font-semibold text-ink-invert before:absolute before:inset-0"
                >
                  {industry.name}
                </Link>
                <p className={MUTED}>
                  /industries/{industry.slug}/ · Order {industry.order}
                </p>
              </div>
              {industry.hasContent ? null : <span className={TAG}>No page copy yet</span>}
              {industry.shadowsSnapshot ? <span className={TAG}>Snapshot still serving this address</span> : null}
              <StatusPill status={industry.status} />
              <span className="text-[12.5px] text-admin-muted tabular-nums sm:w-24 sm:text-right">{when(industry.updatedAt)}</span>
              <ChevronRightIcon className="size-4 shrink-0 text-admin-muted max-sm:hidden" />
            </li>
          ))}
        </ul>
      )}

      <p className={MUTED}>
        Services and case studies have their own screens. An industry without page copy shows its heading and answer
        block alone until copy is added.
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
