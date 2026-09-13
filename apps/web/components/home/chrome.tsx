import type { HomePageView, Link as NavLink, ReviewSummary, SiteContact } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { Wordmark } from '../ui/brand';
import { Stars } from '../ui/primitives';
import { MegaMenuState } from './mega-menu-state';

type Home = HomePageView;

function Chevron() {
  return (
    <svg className="h-2.5 w-2.5 opacity-60" viewBox="0 0 12 8" fill="none" aria-hidden="true">
      <path d="M1 1.5 6 6.5l5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Where the rating comes from. Renders only when review sources are published. */
function ReviewBadge({ reviews }: { reviews: ReviewSummary }) {
  if (reviews.averageRating === null) return null;
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 hover:text-white [&::-webkit-details-marker]:hidden">
        <Stars rating={reviews.averageRating} announce={false} />
        <span className="font-semibold text-white">{reviews.averageRating.toFixed(1)}</span>
        <span>from {reviews.totalReviews} reviews</span>
        <Chevron />
      </summary>
      <div className="absolute top-9 right-0 z-50 w-72 rounded-xl border border-line bg-white p-4 text-ink shadow-2xl">
        <p className="mb-3 font-display text-sm font-bold">Where the rating comes from</p>
        <ul className="space-y-2.5 text-[13px]">
          {reviews.sources.map((source) => (
            <li key={source.platform} className="flex items-center justify-between">
              <span className="text-body">{source.platform}</span>
              <b>{source.rating.toFixed(1)}</b>
            </li>
          ))}
        </ul>
        {reviews.npsScore !== null ? (
          <p className="mt-3 border-t border-line pt-3 text-[12px] text-body">
            Net Promoter Score <b className="text-ink">{reviews.npsScore.toFixed(1)}</b>
          </p>
        ) : null}
      </div>
    </details>
  );
}

export function UtilityBar({
  contact,
  reviews,
  serviceArea,
}: {
  contact: SiteContact;
  reviews: ReviewSummary;
  serviceArea: string | null;
}) {
  return (
    <div className="hidden bg-ink text-[13px] text-white/80 lg:block">
      <div className="shell flex h-11 items-center justify-between">
        <div className="flex items-center gap-6">
          <a href={`tel:${contact.phoneE164}`} className="hover:text-white">
            {contact.phone}
          </a>
          <span className="text-white/25" aria-hidden="true">
            |
          </span>
          <a href={`mailto:${contact.email}`} className="hover:text-white">
            {contact.email}
          </a>
          {serviceArea ? (
            <>
              <span className="text-white/25" aria-hidden="true">
                |
              </span>
              <span>{serviceArea}</span>
            </>
          ) : null}
        </div>
        <ReviewBadge reviews={reviews} />
      </div>
    </div>
  );
}

function MenuList({ title, links, className = 'col-span-3' }: { title?: string; links: NavLink[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <div className={className}>
      {title ? <p className="mb-3 font-display font-bold text-ink">{title}</p> : null}
      <ul className="space-y-2.5 text-[14px]">
        {links.map((link) => (
          <li key={`${link.label}${link.href}`}>
            <a href={link.href} className="hover:text-primary">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Opens on hover and whenever focus is inside it, as approved: keyboard users tab onto the
 * button and on into the panel. Following a link moves focus out (AnchorScroll), which
 * closes it. Escape dismisses it and `aria-expanded` tracks it (MegaMenuState); a
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
        className="flex h-full items-center gap-1.5 px-4 text-[15px] font-medium text-ink group-focus-within/mega:text-primary hover:text-primary"
      >
        {label}
        <Chevron />
      </button>
      <div
        id={`menu-${id}`}
        data-menu={id}
        className="invisible absolute inset-x-0 top-full translate-y-1.5 border-t border-line bg-white opacity-0 shadow-[0_24px_48px_-20px_rgba(10,29,55,.28)] transition duration-150 group-focus-within/mega:visible group-focus-within/mega:translate-y-0 group-focus-within/mega:opacity-100 group-hover/mega:visible group-hover/mega:translate-y-0 group-hover/mega:opacity-100 group-data-dismissed/mega:invisible group-data-dismissed/mega:opacity-0"
      >
        <div className="shell grid grid-cols-12 gap-10 py-10">{children}</div>
      </div>
    </div>
  );
}

const serviceLink = (title: string): NavLink => ({ label: title, href: '#services' });
const industryLink = (name: string): NavLink => ({ label: name, href: '#industries' });

const MORE_LINKS: NavLink[] = [
  { label: 'Case studies', href: '#work' },
  { label: 'Before and after', href: '#beforeafter' },
  { label: 'Technology', href: '#tech' },
  { label: 'Process', href: '#process' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Insights', href: '#insights' },
  { label: 'Cost estimate', href: '#estimate' },
  { label: 'Recognition', href: '#awards' },
  { label: 'Locations', href: '#locations' },
];

/** The small-screen menu: a native disclosure, closed again when a link is followed. */
function MobileMenu({ home }: { home: Home }) {
  const { primaryCta, secondaryCta } = home.content.header;
  const group = (title: string, links: NavLink[]) =>
    links.length > 0 ? (
      <div>
        <p className="mb-2 font-display font-bold text-ink">{title}</p>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-[14px]">
          {links.map((link) => (
            <li key={link.label}>
              <a href={link.href} className="block py-0.5">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <details className="xl:hidden">
      <summary
        aria-label="Menu"
        className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-lg border border-line [&::-webkit-details-marker]:hidden"
      >
        <svg className="h-5 w-5 text-ink" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="absolute inset-x-0 top-full max-h-[calc(100vh-76px)] overflow-y-auto border-t border-line bg-white shadow-[0_24px_48px_-20px_rgba(10,29,55,.28)]">
        <div className="shell space-y-5 py-6">
          {group('Services', home.services.map((service) => serviceLink(service.title)))}
          {group('Industries', home.industries.map((industry) => industryLink(industry.name)))}
          {group('More', MORE_LINKS)}
          <div className="flex gap-3 pt-1">
            <a
              href={primaryCta.href}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-lg bg-primary font-semibold text-white"
            >
              {primaryCta.label}
            </a>
            <a
              href={secondaryCta.href}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-lg border border-line font-semibold text-ink"
            >
              {secondaryCta.label}
            </a>
          </div>
        </div>
      </div>
    </details>
  );
}

export function SiteHeader({ home }: { home: Home }) {
  const { content } = home;
  const promo = content.megaMenu.servicesPromo;
  const industryLinks = home.industries.map((industry) => industryLink(industry.name));
  const industryColumns = [0, 1, 2]
    .map((column) => industryLinks.filter((_link, index) => index % 3 === column))
    .filter((links) => links.length > 0);

  return (
    <header className="header-shadow sticky top-0 z-100 border-b border-line bg-white">
      <div className="shell flex h-[76px] items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- next/link would add about 4 kB of framework runtime; a full navigation home is fine. */}
        <a href="/" className="shrink-0" aria-label="Calwebtech home">
          <Wordmark />
        </a>

        <nav className="hidden h-full items-center xl:flex" aria-label="Main">
          <MegaMenu id="services" label="Services">
            {home.serviceGroups.slice(0, 2).map((group) => (
              <MenuList key={group.name} title={group.name} links={group.services.map((service) => serviceLink(service.title))} />
            ))}
            <div className="col-span-3 col-start-10">
              <div className="flex h-full flex-col rounded-2xl bg-mist p-6">
                <p className="font-display text-[17px] leading-snug font-bold text-ink">{promo.heading}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed">{promo.body}</p>
                <a
                  href={promo.cta.href}
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-ink px-5 text-[14px] font-semibold text-white hover:bg-ink2"
                >
                  {promo.cta.label}
                </a>
              </div>
            </div>
          </MegaMenu>

          <MegaMenu id="industries" label="Industries">
            {industryColumns.map((links) => (
              <MenuList key={links[0]?.label ?? 'industries'} links={links} />
            ))}
          </MegaMenu>

          <MegaMenu id="work" label="Work">
            <MenuList
              title="Browse"
              links={[
                { label: 'Case studies', href: '#work' },
                { label: 'Before and after', href: '#beforeafter' },
                { label: 'Client quotes', href: '#testimonials' },
              ]}
            />
            {home.projects.length > 0 ? (
              <div className="col-span-6 grid grid-cols-2 gap-5">
                {home.projects.slice(0, 2).map((project) => (
                  <a key={project.slug} href="#work" className="group">
                    <p className="font-semibold text-ink group-hover:text-primary">{project.clientName}</p>
                    {project.metrics[0] ? (
                      <p className="text-[13px]">
                        {project.metrics[0].value} {project.metrics[0].label}
                      </p>
                    ) : null}
                  </a>
                ))}
              </div>
            ) : null}
          </MegaMenu>

          <MegaMenu id="resources" label="Resources">
            <MenuList title="Tools" links={[{ label: 'Cost estimate', href: '#estimate' }]} />
            <MenuList
              title="Learn"
              links={[
                { label: 'Insights', href: '#insights' },
                { label: 'How a project runs', href: '#process' },
              ]}
            />
            <MenuList
              title="Company"
              links={[
                { label: 'Recognition', href: '#awards' },
                { label: 'Locations', href: '#locations' },
                { label: 'Contact', href: '#book' },
              ]}
            />
          </MegaMenu>

          <a href="#tech" className="px-4 text-[15px] font-medium text-ink hover:text-primary">
            Technology
          </a>
          <a href="#pricing" className="px-4 text-[15px] font-medium text-ink hover:text-primary">
            Pricing
          </a>
          <MegaMenuState />
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={content.header.secondaryCta.href}
            className="hidden h-11 items-center rounded-lg border border-line px-4 text-[14.5px] font-semibold text-ink hover:border-ink hover:bg-mist2 lg:inline-flex"
          >
            {content.header.secondaryCta.label}
          </a>
          <a
            href={content.header.primaryCta.href}
            className="hidden h-11 items-center rounded-lg bg-primary px-5 text-[14.5px] font-semibold text-white hover:bg-primaryd sm:inline-flex"
          >
            {content.header.primaryCta.label}
          </a>
          <MobileMenu home={home} />
        </div>
      </div>
    </header>
  );
}

function FooterColumn({ title, links }: { title: string; links: NavLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="lg:col-span-2">
      <p className="mb-4 font-display text-[15px] font-bold text-white">{title}</p>
      <ul className="space-y-2.5 text-[14.5px]">
        {links.map((link) => (
          <li key={link.label}>
            <a href={link.href} className="hover:text-white">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter({ home }: { home: Home }) {
  const { content, contact } = home;
  const offices = home.locations.filter((location) => location.address).slice(0, 2);
  return (
    <footer className="relative overflow-hidden bg-ink text-white/70">
      <div className="absolute inset-0" aria-hidden="true">
        <div className="grid-lines-light absolute inset-0" />
        <div className="absolute -top-32 right-10 h-[480px] w-[480px] rounded-full bg-primary/20 blur-3xl" />
      </div>
      <div className="shell relative py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- next/link would add about 4 kB of framework runtime; a full navigation home is fine. */}
            <a href="/" aria-label="Calwebtech home" className="inline-block">
              <Wordmark tone="light" />
            </a>
            <p className="mt-5 max-w-[38ch] text-[15px] leading-relaxed">{content.footer.blurb}</p>
          </div>
          <FooterColumn title="Services" links={home.services.map((service) => serviceLink(service.title))} />
          <FooterColumn title="Industries" links={home.industries.map((industry) => industryLink(industry.name))} />
          <FooterColumn title="Resources" links={content.footer.resources} />
          <FooterColumn title="Company" links={content.footer.company} />
        </div>

        <div className="mt-14 grid gap-8 border-t border-white/10 pt-10 text-[14px] md:grid-cols-3">
          {offices.map((office) => (
            <div key={office.slug}>
              <p className="font-semibold text-white">{office.city}</p>
              <p className="mt-1.5 leading-relaxed whitespace-pre-line">{office.address}</p>
            </div>
          ))}
          <div>
            <p className="font-semibold text-white">Get in touch</p>
            {/* Each link at least 24px tall (WCAG 2.2, 2.5.8 target size). */}
            <ul className="mt-0.5 leading-relaxed">
              <li>
                <a href={`tel:${contact.phoneE164}`} className="inline-block py-1 hover:text-white">
                  {contact.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${contact.email}`} className="inline-block py-1 hover:text-white">
                  {contact.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-6 border-t border-white/10 pt-8 text-[13.5px]">
          <p>&copy; {new Date().getFullYear()} Calwebtech. All rights reserved.</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
            {content.footer.legal.map((link) => (
              <a key={link.label} href={link.href} className="hover:text-white">
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

/** "Start a project", pinned from tablet widths up, as approved. */
export function FloatingCta({ link }: { link: NavLink }) {
  return (
    <a
      href={link.href}
      className="fixed right-6 bottom-6 z-90 hidden items-center rounded-full bg-ink px-6 py-3.5 font-semibold text-white shadow-[0_16px_36px_-12px_rgba(10,29,55,.6)] hover:bg-ink2 md:inline-flex"
    >
      {link.label}
    </a>
  );
}
