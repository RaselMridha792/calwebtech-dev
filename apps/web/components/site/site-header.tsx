import type { Link, SiteChromeView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { asPhrase } from '@/lib/text';
import { ChevronIcon } from '../ui/icons';
import { Logo } from '../ui/logo';
import { ResponsiveImage } from '../ui/responsive-image';
import { MegaMenuState } from './mega-menu-state';

type Menu = SiteChromeView['megaMenu'];
type MenuColumn = Menu['services']['columns'][number];
type MenuPromoContent = Menu['services']['promo'];

/** The header's calls to action. The homepage points them at its own forms (`#book`). */
export interface HeaderCtas {
  primaryCta: Link;
  secondaryCta: Link;
}

function MenuList({ title, links, className = 'col-span-3' }: { title?: string | null; links: Link[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <div className={className}>
      {title ? <p className="eyebrow mb-3 text-ink-muted">{title}</p> : null}
      <ul className="space-y-2.5 text-[14px]">
        {links.map((link) => (
          <li key={`${link.label}${link.href}`}>
            <a href={link.href} className="text-ink-muted transition-colors duration-150 hover:text-gold-ink">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MenuColumns({ columns }: { columns: MenuColumn[] }) {
  return columns.map((column, index) => (
    <MenuList key={`${column.title ?? ''}-${String(index)}`} title={column.title} links={column.links} />
  ));
}

const PROMO_STYLES = {
  mist: {
    box: 'flex h-full flex-col bg-canvas-sunken p-6',
    heading: 'heading-sm text-ink',
    body: 'body-sm mt-2 text-ink-muted',
    cta: 'button-label mt-4 inline-flex h-11 items-center justify-center bg-navy-900 px-5 text-ink-invert transition-colors duration-150 hover:bg-navy-700',
  },
  outline: {
    box: 'border-t border-hairline-gold pt-5',
    heading: 'heading-sm text-ink',
    body: 'body-sm mt-1.5 text-ink-muted',
    cta: 'button-label mt-3 inline-block text-gold-ink underline-offset-4 hover:underline',
  },
  dark: {
    box: 'bg-navy-900 p-6 text-ink-invert',
    heading: 'heading-sm',
    body: 'body-sm mt-2 text-ink-invert-muted',
    cta: 'button-label mt-4 inline-flex h-10 items-center justify-center bg-gold-500 px-4 text-on-gold transition-colors duration-150 hover:bg-gold-300',
  },
} as const;

/** The featured card closing a mega menu panel. */
function MenuPromo({ promo, tone }: { promo: MenuPromoContent; tone: keyof typeof PROMO_STYLES }) {
  const style = PROMO_STYLES[tone];
  return (
    <div className="col-span-3 col-start-10">
      <div className={style.box}>
        <p className={style.heading}>{promo.heading}</p>
        <p className={style.body}>{promo.body}</p>
        <a href={promo.cta.href} className={style.cta}>
          {promo.cta.label}
        </a>
      </div>
    </div>
  );
}

/**
 * Opens on hover and whenever focus is inside it, as approved: keyboard users tab onto the
 * button and on into the panel. Following an in-page link moves focus out (AnchorScroll),
 * which closes it. Escape dismisses it and `aria-expanded` tracks it (MegaMenuState); a
 * dismissed panel is hidden by `data-dismissed` on the group. Desktop only; small screens
 * use MobileMenu.
 */
function MegaMenu({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div data-mega="" className="group/mega flex h-full items-center">
      <button
        type="button"
        aria-expanded={false}
        aria-controls={`menu-${id}`}
        className="nav-label flex h-full items-center gap-1.5 px-4 text-ink transition-colors duration-150 group-focus-within/mega:text-gold-ink hover:text-gold-ink"
      >
        {label}
        <ChevronIcon className="h-2.5 w-2.5 opacity-60" />
      </button>
      <div
        id={`menu-${id}`}
        data-menu={id}
        className="invisible absolute inset-x-0 top-full translate-y-1.5 border-t border-hairline bg-canvas-raised opacity-0 shadow-lift transition duration-150 group-focus-within/mega:visible group-focus-within/mega:translate-y-0 group-focus-within/mega:opacity-100 group-hover/mega:visible group-hover/mega:translate-y-0 group-hover/mega:opacity-100 group-data-dismissed/mega:invisible group-data-dismissed/mega:opacity-0"
      >
        <div className="shell grid grid-cols-12 gap-10 py-10">{children}</div>
      </div>
    </div>
  );
}

/** Splits links into up to `count` columns, filled top to bottom. */
function columnsOf(links: Link[], count: number): Link[][] {
  const size = Math.ceil(links.length / count);
  if (size === 0) return [];
  return Array.from({ length: count }, (_column, index) => links.slice(index * size, (index + 1) * size)).filter(
    (column) => column.length > 0,
  );
}

/** The small-screen menu: a native disclosure, closed again when an in-page link is followed. */
function MobileMenu({ groups, ctas }: { groups: SiteChromeView['mobileMenu']['groups']; ctas: HeaderCtas }) {
  return (
    <details className="xl:hidden">
      <summary
        aria-label="Menu"
        className="grid h-11 w-11 cursor-pointer list-none place-items-center border border-hairline text-ink [&::-webkit-details-marker]:hidden"
      >
        <svg className="h-5 w-5 text-ink" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="absolute inset-x-0 top-full max-h-[calc(100vh-76px)] overflow-y-auto border-t border-hairline bg-canvas-raised shadow-lift">
        <div className="shell space-y-5 py-6">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 font-display font-bold text-ink">{group.title}</p>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-[14px]">
                {group.links.map((link) => (
                  <li key={`${link.label}${link.href}`}>
                    <a href={link.href} className="block py-0.5">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex gap-3 pt-1">
            <a
              href={ctas.primaryCta.href}
              className="button-label inline-flex h-12 flex-1 items-center justify-center bg-navy-900 text-ink-invert"
            >
              {ctas.primaryCta.label}
            </a>
            <a
              href={ctas.secondaryCta.href}
              className="button-label inline-flex h-12 flex-1 items-center justify-center border border-hairline text-ink"
            >
              {ctas.secondaryCta.label}
            </a>
          </div>
        </div>
      </div>
    </details>
  );
}

/**
 * The sticky header with its mega menus, on every site page and the homepage. `ctas`
 * replaces the chrome's calls to action; the homepage passes its in-page ones.
 */
export function SiteHeader({ chrome, ctas }: { chrome: SiteChromeView; ctas?: HeaderCtas }) {
  const menu = chrome.megaMenu;
  const headerCtas = ctas ?? chrome.header;

  return (
    <header className="sticky top-0 z-100 border-b border-hairline bg-canvas-raised">
      <div className="shell flex h-[76px] items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- next/link would add about 4 kB of framework runtime; a full navigation home is fine. */}
        <a href="/" className="shrink-0" aria-label="Calwebtech home">
          <Logo tone="light" height={34} priority />
        </a>

        <nav className="hidden h-full items-center xl:flex" aria-label="Main">
          <MegaMenu id="services" label="Services">
            <MenuColumns columns={menu.services.columns} />
            <MenuPromo promo={menu.services.promo} tone="mist" />
          </MegaMenu>

          <MegaMenu id="industries" label="Industries">
            {columnsOf(menu.industries.links, 3).map((links) => (
              <MenuList key={links[0]?.label ?? 'industries'} links={links} />
            ))}
            {menu.industries.promo ? <MenuPromo promo={menu.industries.promo} tone="outline" /> : null}
          </MegaMenu>

          <MegaMenu id="work" label="Work">
            <MenuColumns columns={menu.work.columns} />
            {menu.work.featured.length > 0 ? (
              <div className="col-span-6 grid grid-cols-2 gap-5">
                {menu.work.featured.map((project) => (
                  <a key={project.href} href={project.href} className="group">
                    {project.image ? (
                      <div className="relative mb-2.5 aspect-[16/10] overflow-hidden bg-canvas-sunken">
                        <ResponsiveImage src={project.image.src} alt="" fill sizes="320px" className="object-cover" />
                      </div>
                    ) : null}
                    <p className="heading-sm text-ink transition-colors duration-150 group-hover:text-gold-ink">{project.clientName}</p>
                    {project.metric ? (
                      <p className="text-[13px]">{`${project.metric.value} ${asPhrase(project.metric.label)}`}</p>
                    ) : null}
                  </a>
                ))}
              </div>
            ) : null}
          </MegaMenu>

          <MegaMenu id="resources" label="Resources">
            <MenuColumns columns={menu.resources.columns} />
            {menu.resources.promo ? <MenuPromo promo={menu.resources.promo} tone="dark" /> : null}
          </MegaMenu>

          {chrome.header.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="nav-label relative px-4 py-2 text-ink after:absolute after:inset-x-4 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-gold-ink after:transition-transform after:duration-[420ms] after:ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-gold-ink hover:after:scale-x-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus motion-reduce:after:transition-none"
            >
              {link.label}
            </a>
          ))}
          <MegaMenuState />
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={headerCtas.secondaryCta.href}
            className="button-label hidden h-11 items-center border border-hairline px-5 text-ink transition-colors duration-150 hover:border-hairline-strong hover:bg-canvas-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:inline-flex"
          >
            {headerCtas.secondaryCta.label}
          </a>
          <a
            href={headerCtas.primaryCta.href}
            className="button-label hidden h-11 items-center bg-navy-900 px-6 text-ink-invert transition-colors duration-150 hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:inline-flex"
          >
            {headerCtas.primaryCta.label}
          </a>
          <MobileMenu groups={chrome.mobileMenu.groups} ctas={headerCtas} />
        </div>
      </div>
    </header>
  );
}
