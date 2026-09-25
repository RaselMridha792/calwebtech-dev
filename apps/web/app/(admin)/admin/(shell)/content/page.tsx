import { CONTENT_STATUS_LABELS, adminServiceListSchema } from '@calwebtech/shared';
import Link from 'next/link';
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

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[1000px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Services</h1>
            <p className="mt-0.5 text-[12.5px] text-admin-body">
              {list.items.length} in the database. A published service replaces the committed snapshot for its
              address; every other page keeps rendering from the snapshot as it does today.
            </p>
          </div>
          {mayWrite ? (
            <Link
              href="/admin/content/services/new/"
              className="flex h-8 items-center rounded-[4px] bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh"
            >
              New service
            </Link>
          ) : null}
        </div>

        {list.items.length === 0 ? (
          <div className="mt-10 text-center">
            <h2 className="font-display text-[19px] font-bold tracking-[-0.015em] text-admin-ink">
              No services in the database yet
            </h2>
            <p className="mx-auto mt-2 max-w-[460px] text-[13.5px] leading-[22px] text-admin-body">
              The ten services on the site are still rendered from the committed snapshots. Adding one here does not
              disturb them — it publishes at its own address, and the snapshot keeps serving every other.
            </p>
          </div>
        ) : (
          <ul className="mt-5">
            {list.items.map((service) => (
              <li key={service.id} className="flex flex-wrap items-center gap-3 border-b border-admin-line py-3 first:border-t">
                <div className="min-w-[220px] flex-1">
                  <Link
                    href={`/admin/content/services/${service.id}/`}
                    className="text-[13px] font-semibold text-admin-ink hover:underline"
                  >
                    {service.title}
                  </Link>
                  <p className="text-[11.5px] text-admin-muted">
                    /services/{service.slug}/ · {service.category?.name ?? 'no category'} · order {service.order}
                  </p>
                </div>
                <span className="text-[11.5px] text-admin-body">{CONTENT_STATUS_LABELS[service.status]}</span>
                {service.shadowsSnapshot ? (
                  <span className="text-[11px] text-admin-muted">snapshot still serving this address</span>
                ) : null}
                <span className="text-[11px] text-admin-muted tabular-nums">
                  {new Date(service.updatedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 border-t border-admin-line pt-4 text-[11.5px] text-admin-muted">
          Industries and case studies have their own screens. The other content types — articles, locations, the
          glossary — still come from the snapshots and move across one at a time.
        </p>
      </div>
    </main>
  );
}
