import type { SiteChromeView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { organizationJsonLd } from '@/lib/seo/json-ld';
import { AnchorScroll } from '../motion/anchor-scroll';
import { RevealObserver } from '../motion/reveal-observer';
import { JsonLd } from '../seo/json-ld';
import { ConversionBand } from './conversion-band';
import { FloatingCta } from './floating-cta';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import { SkipLink } from './skip-link';
import { UtilityBar } from './utility-bar';

/**
 * Everything around a site page: skip link, utility bar, header, the page in `<main>`,
 * the closing conversion band, footer, floating call to action, the Organization node and
 * the two motion helpers. Rendered by `app/(marketing)/(site)/layout.tsx`, and by pages
 * outside that layout that need the same frame, such as `app/not-found.tsx`.
 */
export function SiteShell({ chrome, children }: { chrome: SiteChromeView; children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <UtilityBar chrome={chrome} />
      <SiteHeader chrome={chrome} />
      <main id="main">{children}</main>
      <ConversionBand band={chrome.conversionBand} />
      <SiteFooter chrome={chrome} />
      <FloatingCta link={chrome.floatingCta} />
      <JsonLd data={organizationJsonLd({ contact: chrome.contact, offices: chrome.footer.offices })} />
      <RevealObserver />
      <AnchorScroll />
    </>
  );
}
