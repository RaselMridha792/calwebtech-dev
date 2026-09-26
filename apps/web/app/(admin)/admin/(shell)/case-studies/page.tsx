import { CONTENT_STATUS_LABELS, adminCaseStudyListSchema, type ContentStatus } from '@calwebtech/shared';
import Link from 'next/link';
import { ChevronRightIcon, PlusIcon } from '@/components/admin/icons';
import { AdminPage, EmptyState, PageHeader, Panel } from '@/components/admin/ui/page';
import { LIST, LIST_ROW, MUTED, PILL, TAG, button } from '@/components/admin/ui/styles';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * Case studies in the content manager (docs/14-remaining-work.md, task 4): a row per case
 * study with its address, status, and what it still needs before it can be published.
 */
export default async function AdminCaseStudiesPage() {
  const user = await requireModule('content', 'read');
  const list = await adminGet('/admin/case-studies', adminCaseStudyListSchema);
  const mayWrite = user.modules.includes('content') && user.role !== 'VIEWER';

  const newStudy = mayWrite ? (
    <Link href="/admin/case-studies/new/" className={button('primary')}>
      <PlusIcon className="size-4" />
      New case study
    </Link>
  ) : null;

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Content"
        title="Case studies"
        count={list.items.length}
        description="The projects written up on /work/. Publish one here and it takes the place of the site's built-in version at the same address."
        actions={newStudy}
      />

      {list.items.length === 0 ? (
        <Panel flush>
          <EmptyState title="No case studies yet" actions={newStudy}>
            The case studies on the site still come from its built-in copy. Add one here and it publishes at its own
            address under /work/ without disturbing the rest.
          </EmptyState>
        </Panel>
      ) : (
        <ul className={LIST}>
          {list.items.map((study) => (
            <li key={study.id} className={LIST_ROW}>
              <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
                <Link
                  href={`/admin/case-studies/${study.id}/`}
                  className="text-[14.5px] font-semibold text-ink-invert before:absolute before:inset-0"
                >
                  {study.clientName}
                </Link>
                <p className={MUTED}>
                  /work/{study.slug}/{study.featured ? ' · Featured' : ''}
                  {study.notReady ? ` · ${study.notReady}` : ''}
                </p>
              </div>
              {study.shadowsSnapshot ? <span className={TAG}>Snapshot still serving this address</span> : null}
              <StatusPill status={study.status} />
              <span className="text-[12.5px] text-admin-muted tabular-nums sm:w-24 sm:text-right">{when(study.updatedAt)}</span>
              <ChevronRightIcon className="size-4 shrink-0 text-admin-muted max-sm:hidden" />
            </li>
          ))}
        </ul>
      )}
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
