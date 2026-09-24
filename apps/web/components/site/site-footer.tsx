import type { Link, SiteChromeView } from '@calwebtech/shared';
import { BackdropImage } from '../ui/brand';
import { Logo } from '../ui/logo';

function FooterColumn({ title, links }: { title: string; links: Link[] }) {
  if (links.length === 0) return null;
  return (
    <div className="lg:col-span-2">
      <p className="eyebrow mb-4 text-gold-500">{title}</p>
      <ul className="body-sm space-y-2.5">
        {links.map((link) => (
          <li key={`${link.label}${link.href}`}>
            <a href={link.href} className="transition-colors duration-150 hover:text-ink-invert">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The full footer: blurb, link columns, offices, contact and the legal set. The contact
 * block is an email address only. The owner took the telephone number off the whole site on
 * 2026-09-23 until there is one to publish (docs/08-decisions.md, 54), so it is not shown on
 * the contact page or anywhere else either.
 */
export function SiteFooter({ chrome }: { chrome: SiteChromeView }) {
  const { footer } = chrome;
  return (
    <footer className="relative overflow-hidden bg-navy-900 text-ink-invert-muted">
      <div className="absolute inset-0" aria-hidden="true">
        <BackdropImage image={footer.backgroundImage} className="opacity-[.10] mask-b-from-55%" />
      </div>
      <div className="shell relative py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- next/link would add about 4 kB of framework runtime; a full navigation home is fine. */}
            <a href="/" aria-label="Calwebtech home" className="inline-block">
              <Logo tone="dark" layout="horizontal" height={46} />
            </a>
            <p className="body-base mt-5 max-w-[38ch]">{footer.blurb}</p>
          </div>
          {footer.columns.map((column) => (
            <FooterColumn key={column.title} title={column.title} links={column.links} />
          ))}
        </div>

        <div className="body-sm mt-14 grid gap-8 border-t border-ink-invert/15 pt-10 md:grid-cols-3">
          {footer.offices.map((office) => (
            <div key={office.city}>
              <p className="eyebrow text-gold-500">{office.city}</p>
              <p className="mt-1.5 leading-relaxed whitespace-pre-line">{office.address}</p>
            </div>
          ))}
          <div>
            <p className="eyebrow text-gold-500">Contact us</p>
            {/* At least 24px tall (WCAG 2.2, 2.5.8 target size). */}
            <a
              href={`mailto:${footer.contactEmail}`}
              className="mt-0.5 inline-block py-1 leading-relaxed transition-colors duration-150 hover:text-ink-invert"
            >
              {footer.contactEmail}
            </a>
          </div>
        </div>

        <div className="body-sm mt-10 flex flex-wrap items-center justify-between gap-6 border-t border-ink-invert/15 pt-8">
          <p>&copy; {new Date().getFullYear()} Calwebtech. All rights reserved.</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
            {footer.legal.map((link) => (
              <a key={link.label} href={link.href} className="transition-colors duration-150 hover:text-ink-invert">
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
