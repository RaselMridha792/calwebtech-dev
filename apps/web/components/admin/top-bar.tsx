'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import type { PaletteCommand } from './command-palette';
import { ExternalIcon, SearchIcon } from './icons';
import { button, iconButton } from './ui/styles';

/**
 * Loaded the first time someone opens it, so no screen pays for the palette until it is
 * wanted. Ctrl K and the button are all this bar carries for it.
 */
const CommandPalette = dynamic(() => import('./command-palette').then((module) => module.CommandPalette), {
  ssr: false,
});

/**
 * The top bar: where you are, a way to jump anywhere, and the public site.
 *
 * The breadcrumb is derived from the path rather than passed down, because a layout in the
 * App Router cannot be told anything by the page inside it. A record's own name is the
 * heading of its screen, so the bar calls it by its kind.
 */
export function TopBar({
  menu,
  labels,
  commands,
  searchable,
}: {
  /** The sidebar, which also renders the button that opens it under 1024px. */
  menu: ReactNode;
  /** Path segment to page name, so the bar has no second copy of the module list. */
  labels: Record<string, string>;
  /** Everywhere the palette can go, already filtered to what this role reaches. */
  commands: PaletteCommand[];
  /** Listings the palette can search by the words typed. */
  searchable: { label: string; href: string }[];
}) {
  const pathname = usePathname();
  const crumbs = trail(pathname, labels);
  const [palette, setPalette] = useState<'closed' | 'open'>('closed');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setLoaded(true);
        setPalette('open');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const openPalette = (): void => {
    setLoaded(true);
    setPalette('open');
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-admin-line2 px-4 sm:px-6 lg:px-8">
      {menu}

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-2 text-[13.5px]">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={crumb.label + String(index)} className={`min-w-0 items-center gap-2 ${last ? 'flex' : 'hidden sm:flex'}`}>
                {last || !crumb.href ? (
                  <span
                    aria-current={last ? 'page' : undefined}
                    className={`truncate ${last ? 'font-semibold text-ink-invert' : 'text-ink-invert-muted'}`}
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link href={crumb.href} className="truncate text-ink-invert-muted transition-colors duration-150 hover:text-ink-invert">
                    {crumb.label}
                  </Link>
                )}
                {last ? null : (
                  <span aria-hidden className="text-admin-muted">
                    /
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <button
        type="button"
        onClick={openPalette}
        aria-keyshortcuts="Control+K Meta+K"
        className="hidden h-10 w-[300px] items-center gap-2.5 rounded-lg border border-admin-line bg-admin-sunken px-3 text-[13.5px] text-ink-invert-muted transition-colors duration-150 hover:border-admin-edge hover:text-ink-invert md:flex xl:w-[340px]"
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="rounded-md border border-admin-line px-1.5 py-0.5 font-sans text-[11.5px] text-admin-muted">Ctrl K</kbd>
      </button>
      <button type="button" onClick={openPalette} className={`${iconButton()} md:hidden`}>
        <SearchIcon className="size-[18px]" />
        <span className="sr-only">Search or jump to a screen</span>
      </button>

      <a href="/" target="_blank" rel="noopener" className={`${button('secondary')} max-sm:hidden`}>
        View site
        <ExternalIcon className="size-4" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>

      {loaded ? (
        <CommandPalette
          open={palette === 'open'}
          onClose={() => {
            setPalette('closed');
          }}
          commands={commands}
          searchable={searchable}
        />
      ) : null}
    </header>
  );
}

interface Crumb {
  label: string;
  href: string | null;
}

/**
 * `/admin/leads/abc/` becomes Dashboard / Leads / Lead. A segment with no name of its own
 * is a record, and is named by the kind of screen it opens.
 */
function trail(pathname: string, labels: Record<string, string>): Crumb[] {
  const segments = pathname.split('/').filter(Boolean).slice(1);
  const crumbs: Crumb[] = [{ label: 'Dashboard', href: '/admin/' }];
  let seen = '';
  for (const segment of segments) {
    seen = seen ? `${seen}/${segment}` : segment;
    const label = labels[seen];
    // An empty name is a path segment that only groups records, such as `content/services`.
    if (label === '') continue;
    if (label) crumbs.push({ label, href: `/admin/${seen}/` });
    else if (crumbs.length > 1) crumbs.push({ label: segment === 'new' ? 'New' : 'Record', href: null });
  }
  return crumbs;
}
