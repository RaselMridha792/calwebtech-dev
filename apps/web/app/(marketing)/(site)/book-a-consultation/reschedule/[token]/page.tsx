import { bookingTokenSchema } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ManagePage } from '@/components/booking/manage-page';
import { RescheduleForm } from '@/components/booking/reschedule-form';
import { getBookingLink, getBookingSlots } from '@/lib/api/booking';

/**
 * `/book-a-consultation/reschedule/<token>/` (docs/08-decisions.md, 60): the link in a booked
 * call's emails that moves it. The token names one call and allows only this; a token that
 * names nothing, or the cancel link's token, is a 404.
 *
 * Never indexed, and no referrer leaves it, since its address is the credential.
 */
export const metadata: Metadata = {
  title: 'Move your call',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function RescheduleCallPage({ params }: PageProps<'/book-a-consultation/reschedule/[token]'>) {
  const token = bookingTokenSchema.safeParse((await params).token);
  if (!token.success) notFound();
  const view = await getBookingLink(token.data);
  if (!view || view.action !== 'reschedule') notFound();
  const slots = view.open ? await getBookingSlots(view.consultationTypeSlug) : null;

  return (
    <ManagePage
      title="Move your call"
      intro="Choose another time that suits you. The call keeps everything you told us; only the time changes."
      view={view}
    >
      {view.open && slots ? (
        <RescheduleForm token={token.data} slots={slots} current={view.startsAt} typeSlug={view.consultationTypeSlug} />
      ) : (
        <p className="body-lg border-t border-hairline pt-8 text-ink-muted">
          {view.cancelled
            ? 'This call was cancelled, so there is nothing to move.'
            : 'This call can no longer be moved: its time has passed.'}
        </p>
      )}
    </ManagePage>
  );
}
