'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CloseIcon, DisclosureIcon, MenuIcon, SidebarIcon } from './icons';
import { SIDEBAR_COOKIE } from './sidebar-cookie';
import { iconButton } from './ui/styles';
import { UserMenu } from './user-menu';

/**
 * The module navigation: a column beside the page from 1024px, a drawer under it.
 *
 * A client component for four things only: which item is current, whether the drawer is
 * open, whether the column is narrowed to a rail of icons, and which groups are folded.
 * The labels, counts and icons are rendered on the server and handed down as nodes, so no
 * icon set reaches the browser bundle.
 *
 * The rail is remembered in a cookie the layout reads, so a reload draws the page the way
 * it was left rather than drawing it wide and then snapping narrow. The main column finds
 * out through `:has()` on the shell, so narrowing it costs no second render.
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
  /** Null for the ungrouped item at the top: the dashboard itself. */
  label: string | null;
  items: NavItem[];
}


export function Sidebar({
  groups,
  brand,
  mark,
  user,
  initialRail,
}: {
  groups: NavGroup[];
  /** The full lockup, for the wide column and the drawer. */
  brand: ReactNode;
  /** The emblem alone, for the rail. */
  mark: ReactNode;
  /** Who is signed in, for the menu at the foot of the column. */
  user: { name: string; email: string; role: string };
  initialRail: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rail, setRail] = useState(initialRail);
  // Folded groups, by label. The sidebar lives in the layout, so this outlives a
  // navigation; a reload starts everything open again.
  const [folded, setFolded] = useState<readonly string[]>([]);
  const drawerId = useId();
  const groupId = useId();
  const opener = useRef<HTMLButtonElement>(null);

  const close = (): void => {
    setOpen(false);
  };

  // Escape closes the drawer and hands focus back to the button that opened it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      opener.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleRail = (): void => {
    const next = !rail;
    setRail(next);
    // A per-viewer layout preference, read by the layout on the next request.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? 'rail' : 'wide'}; path=/admin; max-age=31536000; samesite=strict`;
  };

  // The dashboard's own address is a prefix of every other, so it only matches exactly.
  const isCurrent = (href: string): boolean =>
    href === '/admin/' ? pathname === '/admin' || pathname === '/admin/' : pathname.startsWith(href);

  // The drawer is never a rail: it has the room, and a phone has no hover for the labels.
  const narrow = rail && !open;

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        aria-expanded={open}
        aria-controls={drawerId}
        className={`${iconButton()} lg:hidden`}
      >
        <MenuIcon className="size-[18px]" />
        <span className="sr-only">Open the menu</span>
      </button>

      {open ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close the menu"
          onClick={close}
          className="fixed inset-0 z-40 bg-scrim-strong lg:hidden"
        />
      ) : null}

      <nav
        id={drawerId}
        aria-label="Modules"
        data-rail={narrow ? '' : undefined}
        className={`fixed inset-y-0 left-0 z-50 flex-col border-r border-admin-line2 bg-admin-ground ${
          open ? 'flex w-[288px] max-w-[85vw] shadow-plate' : 'hidden'
        } lg:flex ${narrow ? 'lg:w-[76px]' : 'lg:w-64'}`}
      >
        <div className={`flex h-16 shrink-0 items-center justify-between gap-2 ${narrow ? 'lg:justify-center lg:px-0' : ''} px-5`}>
          <Link href="/admin/" onClick={close} className="flex items-center rounded-md">
            <span className={narrow ? 'lg:hidden' : ''}>{brand}</span>
            <span className={narrow ? 'hidden lg:block' : 'hidden'}>{mark}</span>
            <span className="sr-only">Dashboard home</span>
          </Link>
          <button type="button" onClick={close} className={`${iconButton('sm')} lg:hidden`}>
            <CloseIcon className="size-4" />
            <span className="sr-only">Close the menu</span>
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto pt-2 pb-4 ${narrow ? 'lg:px-3' : ''} px-3`}>
          {groups.map((group) => {
            const label = group.label;
            const shown = label === null || narrow || !folded.includes(label);
            const listId = `${groupId}-${(label ?? 'top').replace(/\s+/g, '-').toLowerCase()}`;
            return (
              <div key={label ?? 'top'} className="mb-4 last:mb-0">
                {label === null ? null : narrow ? (
                  // The rail has no room for a heading: a rule keeps the groups apart.
                  <span aria-hidden className="mx-auto mb-2 hidden h-px w-6 bg-admin-line lg:block" />
                ) : (
                  <button
                    type="button"
                    aria-expanded={shown}
                    aria-controls={listId}
                    onClick={() => {
                      setFolded((current) =>
                        current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
                      );
                    }}
                    className="group/fold flex h-8 w-full items-center justify-between rounded-md px-3 text-[11.5px] font-semibold tracking-[0.12em] text-admin-muted uppercase transition-colors duration-150 hover:text-ink-invert"
                  >
                    {label}
                    <DisclosureIcon
                      open={shown}
                      className="size-3.5 shrink-0 opacity-0 transition-opacity duration-150 group-hover/fold:opacity-100 group-focus-visible/fold:opacity-100"
                    />
                  </button>
                )}
                {shown ? (
                  <ul id={listId} className="flex flex-col gap-0.5">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <NavLink item={item} current={isCurrent(item.href)} rail={narrow} onFollow={close} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className={`flex shrink-0 items-center gap-2 border-t border-admin-line2 p-3 ${narrow ? 'lg:flex-col' : ''}`}>
          <div className="min-w-0 flex-1 self-stretch">
            <UserMenu name={user.name} email={user.email} role={user.role} rail={narrow} />
          </div>
          <button
            type="button"
            onClick={toggleRail}
            aria-pressed={rail}
            className={`${iconButton('sm')} max-lg:hidden`}
          >
            <SidebarIcon collapsed={rail} className="size-4" />
            <span className="sr-only">{rail ? 'Widen the menu' : 'Narrow the menu to icons'}</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function NavLink({
  item,
  current,
  rail,
  onFollow,
}: {
  item: NavItem;
  current: boolean;
  rail: boolean;
  onFollow: () => void;
}) {
  return (
    <Link
      href={item.href}
      aria-current={current ? 'page' : undefined}
      // On the rail the label is hidden but for a screen reader; the pointer gets it here.
      title={rail ? item.label : undefined}
      // Closes the drawer as it navigates, rather than after, so it never covers the page
      // it just opened.
      onClick={onFollow}
      className={`group/nav relative flex min-h-10 items-center gap-3 rounded-lg text-[14px] transition-colors duration-150 pointer-coarse:min-h-11 ${
        rail ? 'lg:justify-center lg:px-0' : ''
      } px-3 ${
        current
          ? 'bg-admin-nav font-semibold text-ink-invert before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-gold-500'
          : 'font-medium text-ink-invert-muted hover:bg-admin-hover hover:text-ink-invert'
      }`}
    >
      <span className={`flex size-[18px] shrink-0 ${current ? 'text-ink-invert' : 'text-admin-muted group-hover/nav:text-ink-invert'}`}>
        {item.icon}
      </span>
      <span className={`flex-1 truncate ${rail ? 'lg:sr-only' : ''}`}>{item.label}</span>
      {item.count === undefined || item.count === 0 ? null : rail ? (
        // On the rail the count shrinks to a dot on the icon; the number is still read out.
        <>
          <span aria-hidden className="absolute top-2 right-3.5 hidden size-2 rounded-full bg-gold-500 lg:block" />
          <span className="lg:sr-only">{item.count}</span>
        </>
      ) : (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-admin-mist px-1.5 text-[11.5px] font-semibold text-ink-invert tabular-nums">
          {item.count}
        </span>
      )}
    </Link>
  );
}
