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
  /** Null where the bar carries one action, which is the usual case. */
  secondaryCta: Link | null;
}

/**
 * A column rises into place when its panel opens, a beat after the one before it. Opacity and
 * transform only, and nothing moves under reduced motion (RULES.md, section 3). The panel
 * itself is hidden until then, so no content waits on this.
 */
const RISE =
  'translate-y-3 opacity-0 transition duration-500 ease-out-quint group-hover/mega:translate-y-0 group-hover/mega:opacity-100 group-focus-within/mega:translate-y-0 group-focus-within/mega:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none';

/** How long after the panel each part starts to rise: the panel's heading first, then each column. */
const riseDelay = (index: number) => ({ transitionDelay: `${String(90 + index * 55)}ms` });

/**
 * A link in a panel, on the panel's navy ground: a row that lifts on hover, a champagne rule
 * drawing down its left edge, the words stepping aside and an arrow arriving. The link to the
 * page being read keeps the lift and the rule. The arrow and the number are hidden from
 * assistive technology, so the link's name is only its label.
 */
function MenuLink({ link, index }: { link: Link; index?: number }) {
  return (
    <a
      href={link.href}
      className="group/link relative flex items-center gap-3 px-3 py-2.5 text-[15px] leading-snug text-ink-invert-muted transition-colors duration-200 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:origin-top before:scale-y-0 before:bg-gold-500 before:transition-transform before:duration-300 before:ease-out-quint hover:bg-ink-invert/6 hover:text-ink-invert hover:before:scale-y-100 focus-visible:bg-ink-invert/6 focus-visible:text-ink-invert focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-invert data-current:bg-ink-invert/6 data-current:text-ink-invert data-current:before:scale-y-100 motion-reduce:before:transition-none"
    >
      {index === undefined ? null : (
        <span aria-hidden className="w-5 shrink-0 font-mono text-[11px] text-ink-invert-muted/70 tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </span>
      )}
      <span className="min-w-0 flex-1 pr-4 transition-transform duration-300 ease-out-quint group-hover/link:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/link:translate-x-0">
        {link.label}
      </span>
      <span
        aria-hidden
        className="absolute right-3 -translate-x-1.5 text-gold-500 opacity-0 transition duration-300 ease-out-quint group-hover/link:translate-x-0 group-hover/link:opacity-100 group-focus-visible/link:translate-x-0 group-focus-visible/link:opacity-100 motion-reduce:transition-none"
      >
        →
      </span>
    </a>
  );
}

function MenuList({
  title,
  links,
  className = 'col-span-3',
  index = 0,
  numbered = 0,
}: {
  title?: string | null;
  links: Link[];
  className?: string;
  /** Its place among the panel's columns, for the rise. */
  index?: number;
  /** When set, links are numbered from this, for a panel whose columns carry no titles. */
  numbered?: number | null;
}) {
  if (links.length === 0) return null;
  return (
    <div
      className={`${className} ${RISE} border-l border-ink-invert/10 pl-6 first:border-l-0 first:pl-0`}
      style={riseDelay(index + 1)}
    >
      {title ? (
        <p className="eyebrow mb-4 flex items-center gap-3 text-ink-invert-muted before:h-px before:w-5 before:bg-ink-invert/30">
          {title}
        </p>
      ) : null}
      <ul className="-ml-3 flex flex-col">
        {links.map((link, position) => (
          <li key={`${link.label}${link.href}`}>
            <MenuLink link={link} index={numbered === null ? undefined : numbered + position} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A panel is twelve columns and a promo takes the last three, so the lists share nine when
 * there is one, and six beside the Work menu's featured projects. The lists split their room
 * evenly, whatever their number: four lists at a whole number of columns each left the
 * Resources menu with a column to spare and its links wrapping. The classes are written out
 * whole for the stylesheet to find them.
 */
const ROOM = { 6: 'col-span-6', 9: 'col-span-9', 12: 'col-span-12' } as const;

function MenuColumns({ columns, room }: { columns: MenuColumn[]; room: keyof typeof ROOM }) {
  if (columns.length === 0) return null;
  return (
    <div
      className={`${ROOM[room]} grid gap-x-6`}
      style={{ gridTemplateColumns: `repeat(${String(columns.length)}, minmax(0, 1fr))` }}
    >
      {columns.map((column, index) => (
        <MenuList
          key={`${column.title ?? ''}-${String(index)}`}
          title={column.title}
          links={column.links}
          className=""
          index={index}
          numbered={null}
        />
      ))}
    </div>
  );
}

/** How many links a menu's columns hold, for the count above its heading. */
const linkCount = (columns: MenuColumn[]) => columns.reduce((count, column) => count + column.links.length, 0);

/**
 * The featured card closing a panel: one form for every menu, a raised navy plate on the
 * panel's navy, the heading in cream and the one action in champagne. `button` is the gold
 * fill the brand gives an action on a dark ground; `link` is a champagne text link, for a
 * promo that points at reading rather than doing.
 */
function MenuPromo({ promo, action, index }: { promo: MenuPromoContent; action: 'button' | 'link'; index: number }) {
  return (
    <div className={`col-span-3 col-start-10 ${RISE}`} style={riseDelay(index + 1)}>
      <div className="flex h-full flex-col bg-navy-700 p-6">
        <p className="heading-sm text-ink-invert">{promo.heading}</p>
        <p className="body-sm mt-2.5 text-ink-invert-muted">{promo.body}</p>
        {action === 'button' ? (
          <a
            href={promo.cta.href}
            className="button-label mt-auto inline-flex min-h-11 items-center justify-center self-stretch bg-gold-500 px-4 py-2.5 text-center text-on-gold transition-colors duration-150 hover:bg-gold-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-invert"
          >
            {promo.cta.label}
          </a>
        ) : (
          <a
            href={promo.cta.href}
            className="group/promo button-label mt-auto inline-flex items-center gap-2 self-start pt-6 text-gold-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-invert"
          >
            <span className="underline-offset-4 group-hover/promo:underline">{promo.cta.label}</span>
            <span
              aria-hidden
              className="transition-transform duration-300 ease-out-quint group-hover/promo:translate-x-1 motion-reduce:transition-none"
            >
              →
            </span>
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Opens on hover and whenever focus is inside it, so a keyboard user reaches every link by
 * tabbing; MegaMenuState adds Escape and keeps each button's `aria-expanded` honest.
 * Where the family has an index page the label is a link to it, not a button: a menu whose
 * heading cannot be clicked leaves `/services/` reachable only from inside its own panel.
 * The panel still opens on hover and on focus, so the keyboard reaches both the page and
 * the links inside it. Resources has no index page of its own, so it stays a button.
 *
 * The panel is the brand's navy ground dropped from the bar (decision 72): the menu's name
 * set large, with its count and a way to the whole family, then its lists. Behind them the
 * brand's grid fades from the corner and a soft light follows the pointer.
 */
function MegaMenu({
  id,
  label,
  href,
  meta,
  all,
  children,
}: {
  id: string;
  label: string;
  href?: string;
  /** A line over the panel's heading, such as how many pages the menu leads to. */
  meta?: string;
  /** The label of a link to the family's index page, beside the panel's heading. */
  all?: string;
  children: ReactNode;
}) {
  const trigger =
    'nav-label flex h-full items-center gap-1.5 text-ink transition-colors duration-150 group-focus-within/mega:text-gold-ink group-hover/mega:text-gold-ink hover:text-gold-ink';
  // Two rules under the label. The thin one is drawn from the middle while the menu is open;
  // the heavier one stays under the menu that holds the page being read, which MegaMenuState
  // marks `data-current`, so the reader can see where they are.
  const underline = (inset: string) =>
    `relative before:absolute before:bottom-6 before:h-0.5 before:scale-x-0 before:bg-gold-ink group-data-current/mega:before:scale-x-100 after:absolute after:bottom-6 after:h-px after:scale-x-0 after:bg-gold-ink after:transition-transform after:duration-300 after:ease-out-quint group-hover/mega:after:scale-x-100 group-focus-within/mega:after:scale-x-100 group-data-dismissed/mega:after:scale-x-0 motion-reduce:after:transition-none ${inset}`;
  const chevron =
    'h-2.5 w-2.5 opacity-60 transition-transform duration-300 ease-out-quint group-hover/mega:rotate-180 group-focus-within/mega:rotate-180 group-data-dismissed/mega:rotate-0 motion-reduce:transition-none';
  return (
    <div data-mega="" className="group/mega flex h-full items-center">
      {href ? (
        <>
          <a href={href} className={`${trigger} ${underline('before:start-4 before:end-1.5 after:start-4 after:end-1.5')} ps-4 pe-1.5`}>
            {label}
          </a>
          {/* The panel's own control, so the label can navigate and the keyboard can still
              open, dismiss and reopen the menu (MegaMenuState reads this button). */}
          <button
            type="button"
            aria-expanded={false}
            aria-controls={`menu-${id}`}
            className={`${trigger} pe-4 ps-0.5`}
          >
            <ChevronIcon className={chevron} />
            <span className="sr-only">{`${label} menu`}</span>
          </button>
        </>
      ) : (
        <button
          type="button"
          aria-expanded={false}
          aria-controls={`menu-${id}`}
          className={`${trigger} ${underline('before:inset-x-4 after:inset-x-4')} px-4`}
        >
          {label}
          <ChevronIcon className={chevron} />
        </button>
      )}
      <div
        id={`menu-${id}`}
        data-menu={id}
        data-panel=""
        className="invisible absolute inset-x-0 top-full -translate-y-1 overflow-hidden bg-navy-900 text-ink-invert opacity-0 shadow-lift transition duration-300 ease-out-quint group-focus-within/mega:visible group-focus-within/mega:translate-y-0 group-focus-within/mega:opacity-100 group-hover/mega:visible group-hover/mega:translate-y-0 group-hover/mega:opacity-100 group-data-dismissed/mega:invisible group-data-dismissed/mega:opacity-0 motion-reduce:translate-y-0 motion-reduce:transition-none"
      >
        <div
          aria-hidden
          className="grid-lines-light pointer-events-none absolute inset-0"
          style={{ maskImage: 'radial-gradient(ellipse 55% 110% at 0% 0%, black, transparent)' }}
        />
        {/* MegaMenuState moves the light to the pointer; it waits at the heading until then. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(560px circle at var(--spot-x, 18%) var(--spot-y, 0%), color-mix(in srgb, var(--color-ink-invert) 8%, transparent), transparent 70%)',
          }}
        />
        <div className="shell relative pt-9 pb-12">
          <div
            className={`mb-9 flex items-end justify-between gap-6 border-b border-ink-invert/10 pb-6 ${RISE}`}
            style={riseDelay(0)}
          >
            <div>
              {meta ? <p className="meta mb-2 text-gold-500 uppercase">{meta}</p> : null}
              <p className="display-md text-ink-invert">{label}</p>
            </div>
            {href && all ? (
              <a
                href={href}
                className="group/all button-label inline-flex items-center gap-2 pb-1 text-ink-invert transition-colors duration-150 hover:text-gold-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-invert"
              >
                {all}
                <span
                  aria-hidden
                  className="transition-transform duration-300 ease-out-quint group-hover/all:translate-x-1 motion-reduce:transition-none"
                >
                  →
                </span>
              </a>
            ) : null}
          </div>
          <div className="grid grid-cols-12 gap-x-10 gap-y-8">{children}</div>
        </div>
      </div>
      {/* The page behind an open menu dims, so the eye settles on the panel. It takes no
          pointer, so leaving the panel still closes it. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-[76px] bottom-0 -z-10 bg-navy-900/40 opacity-0 transition-opacity duration-300 group-hover/mega:opacity-100 group-focus-within/mega:opacity-100 group-data-dismissed/mega:opacity-0 motion-reduce:transition-none"
      />
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
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </summary>
      <div
        data-panel=""
        className="absolute inset-x-0 top-full max-h-[calc(100vh-76px)] overflow-y-auto border-t border-hairline bg-canvas-raised shadow-lift"
      >
        <div className="shell space-y-5 py-6">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 font-display font-bold text-ink">{group.title}</p>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-[14px]">
                {group.links.map((link) => (
                  <li key={`${link.label}${link.href}`}>
                    <a
                      href={link.href}
                      className="block py-0.5 data-current:text-gold-ink data-current:underline data-current:underline-offset-4"
                    >
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
            {ctas.secondaryCta ? (
              <a
                href={ctas.secondaryCta.href}
                className="button-label inline-flex h-12 flex-1 items-center justify-center border border-hairline text-ink"
              >
                {ctas.secondaryCta.label}
              </a>
            ) : null}
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
    <header
      data-site-header=""
      className="fixed inset-x-0 top-0 z-100 border-b border-hairline bg-canvas/85 transition-colors duration-[420ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
    >
      {/* The page frosts under the bar. The blur is a layer of its own: on the header it would
          make the header the containing block of the fixed dimming behind an open menu. */}
      <span aria-hidden data-header-glass="" className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-xl backdrop-saturate-150" />
      {/* How far down the page the reader is, as a champagne rule along the bar's foot. The
          scroll drives it (globals.css), so it costs no script. */}
      <span aria-hidden data-header-progress="" className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 origin-left bg-gold-ink" />
      <div className="shell flex h-[76px] items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- next/link would add about 4 kB of framework runtime; a full navigation home is fine. */}
        <a href="/" className="shrink-0" aria-label="Calwebtech home">
          {/* One lockup per ground, swapped by the stylesheet: the bar is transparent over a
              dark hero and cream everywhere else, and the navy wordmark vanishes on the first.
              The dark-ground file is lazy, so a page without a dark hero never fetches it. */}
          <Logo tone="light" height={34} priority className="block" data-logo="light-ground" />
          <Logo tone="dark" height={34} lazy className="hidden" data-logo="dark-ground" />
        </a>

        <nav className="hidden h-full items-center xl:flex" aria-label="Main">
          <MegaMenu
            id="services"
            label="Services"
            href="/services/"
            meta={`${String(linkCount(menu.services.columns))} services`}
            all="All services"
          >
            <MenuColumns columns={menu.services.columns} room={9} />
            <MenuPromo promo={menu.services.promo} action="button" index={menu.services.columns.length} />
          </MegaMenu>

          <MegaMenu
            id="industries"
            label="Industries"
            href="/industries/"
            meta={`${String(menu.industries.links.length)} industries`}
            all="All industries"
          >
            {columnsOf(menu.industries.links, 3).map((links, index, all) => (
              <MenuList
                key={links[0]?.label ?? 'industries'}
                links={links}
                index={index}
                // The industries have no column titles, so a running number gives the list its order.
                numbered={all.slice(0, index).reduce((count, column) => count + column.length, 0)}
              />
            ))}
            {menu.industries.promo ? <MenuPromo promo={menu.industries.promo} action="link" index={3} /> : null}
          </MegaMenu>

          <MegaMenu id="work" label="Work" href="/work/">
            <MenuColumns columns={menu.work.columns} room={menu.work.featured.length > 0 ? 6 : 12} />
            {menu.work.featured.length > 0 ? (
              <div className={`col-span-6 grid grid-cols-2 gap-5 ${RISE}`} style={riseDelay(menu.work.columns.length + 1)}>
                {menu.work.featured.map((project) => (
                  // A project is its photograph, darkened from the foot so its figure reads on it.
                  <a
                    key={project.href}
                    href={project.href}
                    className="group/work relative flex aspect-[16/11] flex-col justify-end overflow-hidden bg-navy-700 p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-invert"
                  >
                    {project.image ? (
                      <ResponsiveImage
                        src={project.image.src}
                        alt=""
                        fill
                        sizes="320px"
                        className="object-cover opacity-70 transition duration-700 ease-out-quint group-hover/work:scale-[1.05] group-hover/work:opacity-90 motion-reduce:transition-none motion-reduce:group-hover/work:scale-100"
                      />
                    ) : null}
                    <span aria-hidden className="absolute inset-0 bg-linear-to-t from-navy-900 via-navy-900/55 to-transparent" />
                    {project.metric ? (
                      <p className="relative">
                        <span className="display-md block text-gold-500">{project.metric.value}</span>
                        <span className="body-sm text-ink-invert-muted">{asPhrase(project.metric.label)}</span>
                      </p>
                    ) : null}
                    <p className="heading-sm relative mt-3 flex items-center justify-between gap-3 border-t border-ink-invert/15 pt-3 text-ink-invert">
                      {project.clientName}
                      <span
                        aria-hidden
                        className="-translate-x-1.5 text-gold-500 opacity-0 transition duration-300 ease-out-quint group-hover/work:translate-x-0 group-hover/work:opacity-100 motion-reduce:transition-none"
                      >
                        →
                      </span>
                    </p>
                  </a>
                ))}
              </div>
            ) : null}
          </MegaMenu>

          <MegaMenu
            id="resources"
            label="Resources"
            meta={`${String(linkCount(menu.resources.columns))} resources`}
          >
            <MenuColumns columns={menu.resources.columns} room={menu.resources.promo ? 9 : 12} />
            {menu.resources.promo ? (
              <MenuPromo promo={menu.resources.promo} action="button" index={menu.resources.columns.length} />
            ) : null}
          </MegaMenu>

          {chrome.header.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="nav-label relative px-4 py-2 text-ink after:absolute after:inset-x-4 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-gold-ink after:transition-transform after:duration-[420ms] after:ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-gold-ink hover:after:scale-x-100 data-current:after:scale-x-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus motion-reduce:after:transition-none"
            >
              {link.label}
            </a>
          ))}
          <MegaMenuState />
        </nav>

        <div className="flex items-center gap-3">
          {headerCtas.secondaryCta ? (
            <a
              href={headerCtas.secondaryCta.href}
              data-cta="outline"
              className="button-label hidden h-11 items-center border border-hairline px-5 text-ink transition-colors duration-150 hover:border-hairline-strong hover:bg-canvas-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:inline-flex"
            >
              {headerCtas.secondaryCta.label}
            </a>
          ) : null}
          <a
            href={headerCtas.primaryCta.href}
            data-cta=""
            className="group/cta button-label hidden h-11 items-center gap-2.5 bg-navy-900 px-6 text-ink-invert transition-colors duration-150 hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:inline-flex"
          >
            {headerCtas.primaryCta.label}
            <span
              aria-hidden
              className="text-gold-500 transition-transform duration-300 ease-out-quint group-hover/cta:translate-x-1 motion-reduce:transition-none"
            >
              →
            </span>
          </a>
          <MobileMenu groups={chrome.mobileMenu.groups} ctas={headerCtas} />
        </div>
      </div>
    </header>
  );
}
