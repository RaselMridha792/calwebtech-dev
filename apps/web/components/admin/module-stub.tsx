import Link from 'next/link';

/**
 * A module that has its place in the shell but nothing behind it yet
 * (docs/12-admin-dashboard.md, screen 4).
 *
 * The note says which milestone it is waiting on, so the dashboard is honest about what it
 * cannot do rather than showing an empty screen that looks broken.
 */
export function ModuleStub({ group, title, note }: { group: string; title: string; note: string }) {
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-6 py-16">
      <div className="max-w-[440px] text-center">
        <p className="text-[10px] font-bold tracking-[0.14em] text-admin-muted uppercase">{group}</p>
        <h1 className="mt-2 font-display text-[26px] font-bold tracking-[-0.025em] text-admin-ink">{title}</h1>
        <p className="mt-2.5 text-[13.5px] leading-[22px] text-admin-body">{note}</p>
        <Link
          href="/admin/leads/"
          className="mt-5 inline-flex h-8 items-center rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink"
        >
          Back to leads
        </Link>
      </div>
    </main>
  );
}
