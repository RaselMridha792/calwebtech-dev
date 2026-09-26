import { CONSULTATION_PATH, bookingTokenSchema } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CancelForm } from '@/components/booking/cancel-form';
import { ManagePage } from '@/components/booking/manage-page';
import { getBookingLink } from '@/lib/api/booking';

/**
 * `/book-a-consultation/cancel/<token>/` (docs/08-decisions.md, 60): the link in a booked
 * call's emails that cancels it. The token names one call and allows only this; a token that
 * names nothing, or the move link's token, is a 404.
 *
 * Never indexed, and no referrer leaves it, since its address is the credential.
 */
export const metadata: Metadata = {
  title: 'Cancel your call',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function CancelCallPage({ params }: PageProps<'/book-a-consultation/cancel/[token]'>) {
  const token = bookingTokenSchema.safeParse((await params).token);
  if (!token.success) notFound();
  const view = await getBookingLink(token.data);
  if (!view || view.action !== 'cancel') notFound();

  return (
    <ManagePage
      title="Cancel your call"
      intro="If the time no longer works, you can move it instead from the other link in your email. Cancelling frees the time for somebody else."
      view={view}
    >
      {view.cancelled ? (
        <p className="body-lg border-t border-hairline pt-8 text-ink-muted">
          This call is already cancelled. You can{' '}
          <a href={CONSULTATION_PATH} className="text-ink underline decoration-hairline-gold underline-offset-4">
            book another time
          </a>{' '}
          whenever suits you.
        </p>
      ) : view.open ? (
        <CancelForm token={token.data} bookAgainHref={CONSULTATION_PATH} />
      ) : (
        <p className="body-lg border-t border-hairline pt-8 text-ink-muted">
          This call can no longer be cancelled here: its time has passed.
        </p>
      )}
    </ManagePage>
  );
}
