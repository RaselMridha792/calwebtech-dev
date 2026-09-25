import { CONTENT_STATUS_LABELS, adminCaseStudyListSchema } from '@calwebtech/shared';
import Link from 'next/link';
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

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[1000px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Case studies</h1>
            <p className="mt-0.5 text-[12.5px] text-admin-body">
              {list.items.length} in the database. A published case study replaces the committed snapshot for its
              address when the site reads case studies from the database first.
            </p>
          </div>
          {mayWrite ? (
            <Link
              href="/admin/case-studies/new/"
              className="flex h-8 items-center rounded-[4px] bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh"
            >
              New case study
            </Link>
          ) : null}
        </div>

        {list.items.length === 0 ? (
          <div className="mt-10 text-center">
            <h2 className="font-display text-[19px] font-bold tracking-[-0.015em] text-admin-ink">
              No case studies in the database yet
            </h2>
            <p className="mx-auto mt-2 max-w-[460px] text-[13.5px] leading-[22px] text-admin-body">
              The case studies on the site are still rendered from the committed snapshots until the snapshot import
              brings them in. Adding one here publishes it at its own address.
            </p>
          </div>
        ) : (
          <ul className="mt-5">
            {list.items.map((study) => (
              <li key={study.id} className="flex flex-wrap items-center gap-3 border-b border-admin-line py-3 first:border-t">
                <div className="min-w-[220px] flex-1">
                  <Link
                    href={`/admin/case-studies/${study.id}/`}
                    className="text-[13px] font-semibold text-admin-ink hover:underline"
                  >
                    {study.clientName}
                  </Link>
                  <p className="text-[11.5px] text-admin-muted">
                    /work/{study.slug}/{study.featured ? ' · featured' : ''}
                    {study.notReady ? ` · ${study.notReady}` : ''}
                  </p>
                </div>
                <span className="text-[11.5px] text-admin-body">{CONTENT_STATUS_LABELS[study.status]}</span>
                {study.shadowsSnapshot ? (
                  <span className="text-[11px] text-admin-muted">snapshot still serving this address</span>
                ) : null}
                <span className="text-[11px] text-admin-muted tabular-nums">
                  {new Date(study.updatedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
