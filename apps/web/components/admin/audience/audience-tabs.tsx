import { SUBSCRIBER_STATUS_LABELS, type SubscriberStatus } from '@calwebtech/shared';
import { LinkTabs } from '@/components/admin/ui/page';
import { PILL } from '@/components/admin/ui/styles';

const TABS = [
  { key: 'subscribers', href: '/admin/subscribers/', label: 'Subscribers' },
  { key: 'segments', href: '/admin/subscribers/segments/', label: 'Segments' },
  { key: 'suppression', href: '/admin/subscribers/suppression/', label: 'Suppression list' },
] as const;

/** The three screens of the subscribers module, one sidebar entry between them. */
export function AudienceTabs({ current }: { current: (typeof TABS)[number]['key'] }) {
  return (
    <LinkTabs
      label="Subscribers module"
      tabs={TABS.map((tab) => ({ href: tab.href, label: tab.label, current: current === tab.key }))}
    />
  );
}

/**
 * A subscriber's state as a pill with a dot, the way the inbox marks a lead. Teal is the
 * one affirmative mark — an address that can be mailed; the two states that stop the mail
 * share the quiet ring and the muted fill, so the word does the telling.
 */
const DOT: Record<SubscriberStatus, string> = {
  active: 'rounded-full bg-result',
  unsubscribed: 'rounded-full bg-admin-surface ring-2 ring-admin-muted ring-inset',
  suppressed: 'rounded-full bg-admin-muted',
};

export function SubscriberStatusPill({ status }: { status: SubscriberStatus }) {
  return (
    <span className={`${PILL} pl-2`}>
      <span aria-hidden className={`size-2 shrink-0 ${DOT[status]}`} />
      {SUBSCRIBER_STATUS_LABELS[status]}
    </span>
  );
}
