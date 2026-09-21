'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState, type ReactNode } from 'react';
import { CloseIcon, DisclosureIcon, MenuIcon } from './icons';

/**
 * The module navigation, and the button that opens it under 1024px.
 *
 * A client component for two things only: which item is current, and whether the drawer is
 * open. The labels, counts and icons are rendered on the server and handed down as nodes,
 * so no icon set reaches the browser bundle.
 *
 * The column is `fixed` at every width — as the design specifies — which is also what lets
 * the whole thing live inside the top bar in the markup while sitting beside it on screen.
 * The main column reserves the space with padding.
 *
 * A module the signed-in role cannot reach is never passed in. The API refuses those routes
 * too, which is the check that actually keeps anyone out.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  count?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const ADMIN_SIDEBAR_WIDTH = 'lg:pl-[246px]';

export function Sidebar({
  groups,
  footer,
  brand,
}: {
  groups: NavGroup[];
  /** Settings sits apart, pinned to the bottom. */
  footer: NavItem;
  brand: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Folded groups, by label. The sidebar lives in the layout, so this outlives a
  // navigation; a reload starts everything open again, which is the honest default for a
  // menu nobody has touched yet.
  const [folded, setFolded] = useState<readonly string[]>([]);
  const drawerId = useId();
  const groupId = useId();
  const close = (): void => {
    setOpen(false);
  };

  const isCurrent = (href: string): boolean => pathname === href || pathname.startsWith(href);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        aria-expanded={open}
        aria-controls={drawerId}
        className="flex size-9 shrink-0 items-center justify-center rounded-[4px] border border-admin-line text-admin-ink lg:hidden"
      >
        <MenuIcon className="size-[15px]" />
        <span className="sr-only">Open the module menu</span>
      </button>

      {open ? (
        <button type="button" aria-label="Close the module menu" onClick={close} className="fixed inset-0 z-40 bg-ink/60 lg:hidden" />
      ) : null}

      <nav
        id={drawerId}
        aria-label="Modules"
        className={`fixed inset-y-0 left-0 z-50 flex-col bg-admin-sidebar ${
          open ? 'flex w-[262px]' : 'hidden'
        } lg:flex lg:w-[246px]`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-admin-line2 px-4">
          {brand}
          <button
            type="button"
            onClick={close}
            className="flex size-7 items-center justify-center rounded-[4px] text-admin-navink lg:hidden"
          >
            <CloseIcon className="size-4" />
            <span className="sr-only">Close the module menu</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pt-3 pb-4">
          {groups.map((group) => {
            const shown = !folded.includes(group.label);
            const listId = `${groupId}-${group.label.replace(/\s+/g, '-').toLowerCase()}`;
            return (
              <div key={group.label} className="mb-4">
                <button
                  type="button"
                  aria-expanded={shown}
                  aria-controls={listId}
                  onClick={() => {
                    setFolded((current) =>
                      current.includes(group.label)
                        ? current.filter((label) => label !== group.label)
                        : [...current, group.label],
                    );
                  }}
                  className="flex w-full items-center justify-between rounded-[4px] px-3 pt-1.5 pb-2 text-[11px] font-bold tracking-[0.14em] text-admin-muted uppercase hover:text-admin-navink"
                >
                  {group.label}
                  <DisclosureIcon open={shown} className="size-3.5 shrink-0 opacity-70" />
                </button>
                {shown ? (
                  <ul id={listId} className="flex flex-col gap-0.5">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <NavLink item={item} current={isCurrent(item.href)} onFollow={close} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-admin-line2 px-2 pt-2 pb-3.5">
          <NavLink item={footer} current={isCurrent(footer.href)} onFollow={close} />
        </div>
      </nav>
    </>
  );
}

function NavLink({ item, current, onFollow }: { item: NavItem; current: boolean; onFollow: () => void }) {
  return (
    <Link
      href={item.href}
      aria-current={current ? 'page' : undefined}
      // Closes the drawer as it navigates, rather than after, so it never covers the page
      // it just opened.
      onClick={onFollow}
      className={`flex min-h-9 items-center justify-between rounded-r-[4px] px-3 py-[7px] text-[14.5px] transition-colors duration-150 ${
        current
          ? 'border-l-2 border-primary bg-admin-nav font-semibold text-white'
          : 'font-medium text-admin-navink hover:bg-admin-nav hover:text-white'
      }`}
    >
      <span className="flex items-center gap-[11px]">
        <span className="flex size-[17px] shrink-0 opacity-90">{item.icon}</span>
        {item.label}
      </span>
      {item.count === undefined ? null : <span className="text-[12.5px] font-semibold tabular-nums">{item.count}</span>}
    </Link>
  );
}
