import { PAGE_COPY_LABELS, adminPageCopyListSchema } from '@calwebtech/shared';
import Link from 'next/link';
import { AdminPage, PageHeader } from '@/components/admin/ui/page';
import { LIST, LIST_ROW, MUTED, TAG, button } from '@/components/admin/ui/styles';
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
    <AdminPage>
      <PageHeader
        eyebrow="Content"
        title="Page copy"
        count={list.items.length}
        description="The words on the pages that are not a service, an industry or a case study: the homepage, the booking page, the thank-you pages and the index pages. Every change is checked against the page before it is stored, and written to the audit log."
      />

      <ul className={LIST}>
        {list.items.map((item) => {
          const label = PAGE_COPY_LABELS[item.key];
          return (
            <li key={item.key} className={LIST_ROW}>
              <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
                {item.stored ? (
                  <Link
                    href={`/admin/page-copy/${encodeURIComponent(item.key)}/`}
                    className="text-[14.5px] font-semibold text-ink-invert before:absolute before:inset-0"
                  >
                    {label.title}
                  </Link>
                ) : (
                  <span className="text-[14.5px] font-semibold text-ink-invert">{label.title}</span>
                )}
                <p className="text-[13.5px] leading-[1.5] text-ink-invert-muted">{label.help}</p>
                <p className={MUTED}>
                  {item.stored
                    ? pageCopyLiveNote(item.key)
                    : 'Not stored yet. It is written on the next deploy, and can be edited here after that.'}
                </p>
              </div>
              {item.updatedAt ? (
                <span className="text-[12.5px] whitespace-nowrap text-admin-muted tabular-nums sm:text-right">
                  Changed {when(item.updatedAt)}
                </span>
              ) : null}
              {item.stored ? (
                <span aria-hidden className={button('secondary', 'sm')}>
                  Edit
                </span>
              ) : (
                <span className={TAG}>Not editable yet</span>
              )}
            </li>
          );
        })}
      </ul>
    </AdminPage>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
