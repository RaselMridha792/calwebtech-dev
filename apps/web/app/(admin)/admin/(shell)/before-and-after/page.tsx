import { CONTENT_STATUS_LABELS, adminComparisonListSchema, type ContentStatus } from '@calwebtech/shared';
import Link from 'next/link';
import { ChevronRightIcon, PlusIcon } from '@/components/admin/icons';
import { AdminPage, EmptyState, PageHeader, Panel } from '@/components/admin/ui/page';
import { LIST, LIST_ROW, MUTED, PILL, TAG, button } from '@/components/admin/ui/styles';
import { adminGet } from '@/lib/admin/api';
import { comparisonsLiveNote } from '@/lib/admin/comparisons';
import { requireModule } from '@/lib/admin/session';

/**
 * `/before-and-after/` in the content manager (docs/15-next-tasks.md, task 4;
 * docs/08-decisions.md, 70): a row per comparison in the page's order, with its state and the
 * one the homepage shows.
 */
export default async function AdminComparisonsPage() {
  const user = await requireModule('content', 'read');
  const list = await adminGet('/admin/comparisons', adminComparisonListSchema);
  const mayWrite = user.modules.includes('content') && user.role !== 'VIEWER';

  const add = mayWrite ? (
    <Link href="/admin/before-and-after/new/" className={button('primary')}>
      <PlusIcon className="size-4" />
      New comparison
    </Link>
  ) : null;

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Content"
        title="Before and after"
        count={list.items.length}
        description="The comparisons on /before-and-after/, in the order the page lists them. The homepage shows the first published one marked for it."
        actions={add}
      />
      <p className={`${MUTED} -mt-2 mb-5`}>{comparisonsLiveNote()}</p>

      {list.items.length === 0 ? (
        <Panel flush>
          <EmptyState title="No comparisons yet" actions={add}>
            A comparison is two pictures of the same site, before and after the redesign, with a heading and what changed.
            Add one here and publish it to show it on /before-and-after/.
          </EmptyState>
        </Panel>
      ) : (
        <ul className={LIST}>
          {list.items.map((item) => (
            <li key={item.id} className={LIST_ROW}>
              <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
                <Link
                  href={`/admin/before-and-after/${item.id}/`}
                  className="text-[14.5px] font-semibold text-ink-invert before:absolute before:inset-0"
                >
                  {item.clientName}
                </Link>
                <p className={MUTED}>
                  Position {String(item.order)} · {item.heading}
                  {item.caseStudy ? ` · links /work/${item.caseStudy.slug}/` : ''}
                </p>
              </div>
              {item.shownOnHomepage ? (
                <span className={TAG}>On the homepage</span>
              ) : item.onHomepage ? (
                <span className={TAG}>Marked for the homepage</span>
              ) : null}
              <StatusPill status={item.status} />
              <span className="text-[12.5px] text-admin-muted tabular-nums sm:w-24 sm:text-right">{when(item.updatedAt)}</span>
              <ChevronRightIcon className="size-4 shrink-0 text-admin-muted max-sm:hidden" />
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}

/** Teal is a round affirmative mark and nothing else, so only a published comparison gets it. */
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
