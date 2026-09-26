import { SUBSCRIBE_SOURCE_HOME, type SubscribeCopy } from '@calwebtech/shared';
import { reveal } from '@/components/ui/primitives';
import { SubscribeForm } from '../subscribe/subscribe-form';

/**
 * "Subscribe now": a call to action that takes one thing, an email address.
 *
 * It sits between the booking band and the footer, on cream, so the grounds still alternate
 * (the band above is `canvas-sunken` and the footer is dark). This is where the subscribers
 * the campaign engine mails come from (docs/08-decisions.md, 53). The words are the
 * homepage's `subscribe` content, so they are edited like every other line on the page.
 */
export function SubscribeBand({
  copy,
  turnstileSiteKey,
}: {
  copy: SubscribeCopy;
  turnstileSiteKey: string | undefined;
}) {
  return (
    <section
      id="subscribe"
      aria-labelledby="subscribe-heading"
      className="content-auto border-t border-hairline bg-canvas py-20 lg:py-28"
    >
      <div className="shell grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6" {...reveal()}>
          <h2 id="subscribe-heading" className="display-lg text-ink">
            {copy.heading}
          </h2>
          <p className="body-lg mt-5 max-w-[48ch] text-ink-muted">{copy.intro}</p>
        </div>
        <div className="lg:col-span-6" {...reveal(1)}>
          <SubscribeForm copy={copy} sourcePage={SUBSCRIBE_SOURCE_HOME} turnstileSiteKey={turnstileSiteKey} />
        </div>
      </div>
    </section>
  );
}
