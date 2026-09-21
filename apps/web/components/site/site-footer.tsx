import type { Link, SiteChromeView } from '@calwebtech/shared';
import { BackdropImage } from '../ui/brand';
import { Logo } from '../ui/logo';

function FooterColumn({ title, links }: { title: string; links: Link[] }) {
  if (links.length === 0) return null;
  return (
    <div className="lg:col-span-2">
      <p className="mb-4 font-display text-[15px] font-bold text-white">{title}</p>
      <ul className="space-y-2.5 text-[14.5px]">
        {links.map((link) => (
          <li key={`${link.label}${link.href}`}>
            <a href={link.href} className="hover:text-white">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The full footer: blurb, link columns, offices, contact and the legal set. */
export function SiteFooter({ chrome }: { chrome: SiteChromeView }) {
  const { contact, footer } = chrome;
  return (
    <footer className="relative overflow-hidden bg-ink text-white/70">
      <div className="absolute inset-0" aria-hidden="true">
        <BackdropImage image={footer.backgroundImage} className="opacity-[.10] mask-b-from-55%" />
        <div className="grid-lines-light absolute inset-0" />
        <div className="absolute -top-32 right-10 h-[480px] w-[480px] rounded-full bg-primary/20 blur-3xl" />
      </div>
      <div className="shell relative py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- next/link would add about 4 kB of framework runtime; a full navigation home is fine. */}
            <a href="/" aria-label="Calwebtech home" className="inline-block">
              <Logo tone="dark" layout="horizontal" height={46} />
            </a>
            <p className="mt-5 max-w-[38ch] text-[15px] leading-relaxed">{footer.blurb}</p>
          </div>
          {footer.columns.map((column) => (
            <FooterColumn key={column.title} title={column.title} links={column.links} />
          ))}
        </div>

        <div className="mt-14 grid gap-8 border-t border-white/10 pt-10 text-[14px] md:grid-cols-3">
          {footer.offices.map((office) => (
            <div key={office.city}>
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
            {footer.legal.map((link) => (
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
