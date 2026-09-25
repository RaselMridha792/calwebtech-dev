import { PAGE_COPY_LABELS, adminPageCopyListSchema } from '@calwebtech/shared';
import Link from 'next/link';
import { adminGet } from '@/lib/admin/api';
import { pageCopyLiveNote } from '@/lib/admin/page-copy';
import { requireModule } from '@/lib/admin/session';

/**
 * Page copy (docs/14-remaining-work.md, task 4): the copy that belongs to no record, which
 * only `settings-cli` on the server could change before, now edited and audited here.
 */
export default async function AdminPageCopyPage() {
  await requireModule('content', 'read');
  const list = await adminGet('/admin/page-copy', adminPageCopyListSchema);

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[1000px]">
        <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Page copy</h1>
        <p className="mt-0.5 text-[12.5px] text-admin-body">
          The words on pages that are not a service, an industry or a case study. Each change is checked against the
          page before it is stored, and written to the audit log.
        </p>
        <ul className="mt-5">
          {list.items.map((item) => {
            const label = PAGE_COPY_LABELS[item.key];
            return (
              <li key={item.key} className="flex flex-wrap items-center gap-3 border-b border-admin-line py-3 first:border-t">
                <div className="min-w-[240px] flex-1">
                  {item.stored ? (
                    <Link
                      href={`/admin/page-copy/${encodeURIComponent(item.key)}/`}
                      className="text-[13px] font-semibold text-admin-ink hover:underline"
                    >
                      {label.title}
                    </Link>
                  ) : (
                    <span className="text-[13px] font-semibold text-admin-ink">{label.title}</span>
                  )}
                  <p className="text-[11.5px] text-admin-muted">{label.help}</p>
                  <p className="text-[11px] text-admin-muted">
                    {item.stored ? pageCopyLiveNote(item.key) : 'Not stored yet: the snapshot import writes it on the next deploy.'}
                  </p>
                </div>
                {item.updatedAt ? (
                  <span className="text-[11px] text-admin-muted tabular-nums">
                    {new Date(item.updatedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
