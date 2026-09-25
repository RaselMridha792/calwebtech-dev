import { CONTENT_STATUS_LABELS, adminIndustryListSchema } from '@calwebtech/shared';
import Link from 'next/link';
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

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[1000px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Industries</h1>
            <p className="mt-0.5 text-[12.5px] text-admin-body">
              {list.items.length} in the database. A published industry replaces the committed snapshot for its address
              when the site reads industries from the database first.
            </p>
          </div>
          {mayWrite ? (
            <Link
              href="/admin/industries/new/"
              className="flex h-8 items-center rounded-[4px] bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh"
            >
              New industry
            </Link>
          ) : null}
        </div>

        {list.items.length === 0 ? (
          <div className="mt-10 text-center">
            <h2 className="font-display text-[19px] font-bold tracking-[-0.015em] text-admin-ink">
              No industries in the database yet
            </h2>
            <p className="mx-auto mt-2 max-w-[460px] text-[13.5px] leading-[22px] text-admin-body">
              The industries on the site are still rendered from the committed snapshots until the snapshot import brings
              them in. Adding one here publishes it at its own address.
            </p>
          </div>
        ) : (
          <ul className="mt-5">
            {list.items.map((industry) => (
              <li key={industry.id} className="flex flex-wrap items-center gap-3 border-b border-admin-line py-3 first:border-t">
                <div className="min-w-[220px] flex-1">
                  <Link
                    href={`/admin/industries/${industry.id}/`}
                    className="text-[13px] font-semibold text-admin-ink hover:underline"
                  >
                    {industry.name}
                  </Link>
                  <p className="text-[11.5px] text-admin-muted">
                    /industries/{industry.slug}/ · order {industry.order}
                    {industry.hasContent ? '' : ' · no page copy yet'}
                  </p>
                </div>
                <span className="text-[11.5px] text-admin-body">{CONTENT_STATUS_LABELS[industry.status]}</span>
                {industry.shadowsSnapshot ? (
                  <span className="text-[11px] text-admin-muted">snapshot still serving this address</span>
                ) : null}
                <span className="text-[11px] text-admin-muted tabular-nums">
                  {new Date(industry.updatedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
