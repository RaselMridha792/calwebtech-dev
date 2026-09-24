import { unsubscribeViewSchema, type UnsubscribeView } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHasOwnForm } from '@/components/site/conversion-band';
import { PageHero } from '@/components/site/page-hero';
import { apiUrl, hasApi } from '@/lib/api/core';
import { HERO_BACKDROPS } from '@/lib/hero-backdrops';
import { sitePageMetadata } from '@/lib/seo/page-metadata';
import { unsubscribe } from './actions';

const PATH = '/unsubscribe/';

export async function generateMetadata(): Promise<Metadata> {
  // A personal link, never a search result.
  return sitePageMetadata({
    title: 'Unsubscribe',
    description: 'Stop receiving campaign emails from Calwebtech.',
    path: PATH,
    noindex: true,
  });
}

type Lookup = { state: 'ready'; view: UnsubscribeView } | { state: 'unknown' } | { state: 'unavailable' };

async function lookup(token: string): Promise<Lookup> {
  if (!hasApi()) return { state: 'unavailable' };
  try {
    const response = await fetch(apiUrl(`/unsubscribe/${encodeURIComponent(token)}`), { cache: 'no-store' });
    if (response.status === 404) return { state: 'unknown' };
    if (!response.ok) return { state: 'unavailable' };
    return { state: 'ready', view: unsubscribeViewSchema.parse(await response.json()) };
  } catch {
    return { state: 'unavailable' };
  }
}

/**
 * /unsubscribe/<token>/ (Task 5.4): where the link in a campaign's footer lands.
 *
 * Opening the page changes nothing; the button does. A link previewed by a mail scanner or
 * opened by mistake must not unsubscribe anybody, so the page asks once, and a mail client's
 * own one-click button uses the `List-Unsubscribe` header instead of this page.
 *
 * No client script: the button is a form posted to a server action.
 */
export default async function UnsubscribePage({ params }: PageProps<'/unsubscribe/[token]'>) {
  const { token } = await params;
  const result = await lookup(token);
  if (result.state === 'unknown') notFound();

  const done = result.state === 'ready' && result.view.unsubscribed;
  const title = done ? 'You are unsubscribed' : 'Unsubscribe from Calwebtech emails';
  const intro =
    result.state === 'unavailable'
      ? 'This page cannot unsubscribe you right now. Try again later, or reply to any of our emails and ask us to stop.'
      : done
        ? `${result.view.email} will not receive campaign emails from us again. Replies to an enquiry you sent are not affected.`
        : `Confirm below and ${result.view.email} will not receive campaign emails from us again.`;

  return (
    <>
      <PageHero
        backdrop={HERO_BACKDROPS.legal}
        crumbs={[{ name: 'Unsubscribe', path: PATH }]}
        title={title}
        intro={intro}
        aside={
          result.state === 'ready' && !done ? (
            <form action={unsubscribe} className="border border-hairline bg-canvas-raised p-7 text-ink-muted sm:p-8">
              <input type="hidden" name="token" value={token} />
              <p className="text-[15.5px] leading-relaxed">
                One click stops every campaign email to this address. It does not delete anything you have sent us.
              </p>
              <button
                type="submit"
                className="mt-6 h-14 w-full bg-navy-900 text-[16px] font-semibold text-ink-invert hover:bg-navy-700"
              >
                Unsubscribe
              </button>
            </form>
          ) : undefined
        }
      />
      <PageHasOwnForm />
    </>
  );
}
