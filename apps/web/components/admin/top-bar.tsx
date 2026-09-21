'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { adminMutate } from '@/lib/admin/mutate';

/**
 * The top bar: where you are, who you are, and the way out.
 *
 * The breadcrumb is derived from the path rather than passed down, because a layout in the
 * App Router cannot be told anything by the page inside it. A record's own name is shown by
 * the panel that opens it, which is where the design puts it as a heading anyway.
 *
 * There is deliberately no global search here: search belongs to the leads filter bar.
 */
export function TopBar({
  menu,
  name,
  role,
  labels,
}: {
  /** The sidebar, which also renders the button that opens it under 1024px. */
  menu: ReactNode;
  name: string;
  role: string;
  /** Path segment to page name, so the bar has no second copy of the module list. */
  labels: Record<string, string>;
}) {
  const pathname = usePathname();
  const crumbs = trail(pathname, labels);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-admin-line bg-admin-surface px-4">
      {menu}

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-[12.5px]">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={crumb} className="flex items-center gap-1.5">
                <span className={last ? 'font-semibold text-white' : 'text-admin-body'} aria-current={last ? 'page' : undefined}>
                  {crumb}
                </span>
                {last ? null : (
                  <span aria-hidden className="text-admin-body">
                    /
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex items-center gap-3 border-l border-admin-line pl-3">
        <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-admin-mist text-[11px] font-bold text-admin-ink">
          {initials(name)}
        </span>
        <span className="hidden flex-col leading-tight lg:flex">
          <span className="text-[12px] text-admin-body">{name}</span>
          <span className="text-[10px] tracking-[0.08em] text-admin-muted uppercase">{role}</span>
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}

function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void adminMutate('/auth/logout', { method: 'POST' })
          .catch(() => undefined)
          // Whatever the API answered, the way out is the sign-in screen. `refresh` clears
          // what was rendered for the old session out of the client cache.
          .finally(() => {
            router.replace('/admin/login/');
            router.refresh();
          });
      }}
      className="h-[30px] rounded-[4px] border border-admin-line bg-admin-surface px-2.5 text-[12px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink disabled:opacity-40"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

/** `/admin/leads/abc/` becomes Admin / Leads / Lead. Unknown segments are left out. */
function trail(pathname: string, labels: Record<string, string>): string[] {
  const segments = pathname.split('/').filter(Boolean).slice(1);
  const crumbs = ['Admin'];
  let seen = '';
  for (const segment of segments) {
    seen = seen ? `${seen}/${segment}` : segment;
    const label = labels[seen];
    if (label) crumbs.push(label);
    else if (crumbs.length > 1) crumbs.push('Record');
  }
  return crumbs;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
