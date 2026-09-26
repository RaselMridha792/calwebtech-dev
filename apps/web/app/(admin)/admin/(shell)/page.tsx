import {
  LEAD_CHANNELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  SETTING_KEYS,
  adminOverviewSchema,
  adminSettingsViewSchema,
  canRead,
  canWrite,
  siteIndexingSchema,
  type AdminOverview,
  type AdminUser,
} from '@calwebtech/shared';
import Link from 'next/link';
import { typeLabel } from '@/components/admin/leads/format';
import { StatusPill } from '@/components/admin/leads/status-pill';
import { attention, delta, greeting, summaryLine, todayLine, type AttentionTone } from '@/components/admin/overview/summary';
import { DailyBars, ShareBar, StatCard } from '@/components/admin/ui/charts';
import { AdminPage, EmptyState, PageHeader, Panel } from '@/components/admin/ui/page';
import { LINK, TAG, TD, TH, button } from '@/components/admin/ui/styles';
import { PlusIcon } from '@/components/admin/icons';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * The dashboard (docs/12-admin-dashboard.md, screen 1): how the site is doing, what is
 * coming up, and what is waiting on someone, each linked to the screen that deals with it.
 *
 * One read from the API, which leaves out every section the role cannot open, so this page
 * never decides what anyone may see: it lays out what it was given.
 */
export default async function DashboardPage() {
  const user = await requireModule('overview');
  const [view, indexing] = await Promise.all([
    adminGet('/admin/overview', adminOverviewSchema),
    siteIndexing(user),
  ]);
  const now = new Date(view.generatedAt);
  const items = attention(view, indexing);

  return (
    <AdminPage>
      <PageHeader
        eyebrow={todayLine(now, view.timeZone)}
        title={greeting(now, view.timeZone, user.name)}
        description={summaryLine(view)}
        actions={<QuickActions user={user} />}
      />

      <Figures view={view} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {view.leads ? (
          <Panel
            title="Leads, last 30 days"
            labelledBy="overview-trend"
            description={`${String(view.leads.month.current)} ${view.leads.month.current === 1 ? 'lead' : 'leads'} · ${String(view.leads.week.current)} in the last seven days`}
            className="xl:col-span-8"
          >
            <DailyBars days={view.leads.daily} label={(day) => dayLabel(day)} />
            <div className="mt-2.5 flex justify-between text-[12px] text-admin-muted">
              <span>{dayLabel(view.leads.daily[0]?.day ?? '')}</span>
              <span>Today</span>
            </div>
          </Panel>
        ) : null}

        <Panel
          title="Needs your attention"
          labelledBy="overview-attention"
          className={view.leads ? 'xl:col-span-4' : 'xl:col-span-12'}
        >
          {items.length === 0 ? (
            <p className="flex items-center gap-3 text-[14px] text-ink-invert-muted">
              <span aria-hidden className="size-2.5 rounded-full bg-result" />
              Nothing is waiting on anyone. Well done.
            </p>
          ) : (
            <ul className="-mx-2.5 -my-1 flex flex-col">
              {items.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    className="group flex min-h-14 items-center gap-3 rounded-lg px-2.5 py-2 transition-colors duration-150 hover:bg-admin-hover"
                  >
                    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-admin-mist">
                      <span className={`size-2 rounded-full ${TONE[item.tone]}`} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[14px] font-semibold text-ink-invert">{item.title}</span>
                      <span className="text-[12.5px] text-admin-muted">{item.note}</span>
                    </span>
                    <span aria-hidden className="text-admin-muted transition-transform duration-150 group-hover:translate-x-0.5">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {view.leads || view.bookings ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {view.leads ? <LatestLeads view={view} wide={!view.bookings} /> : null}
          {view.bookings ? <UpcomingCalls view={view} wide={!view.leads} /> : null}
        </div>
      ) : null}

      {view.leads || view.campaigns ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {view.leads ? <Pipeline view={view} /> : null}
          {view.leads ? <Channels view={view} /> : null}
          {view.campaigns ? <LastCampaign view={view} /> : null}
        </div>
      ) : null}

      {view.content ? <RecentlyEdited view={view} /> : null}
    </AdminPage>
  );
}

const TONE: Record<AttentionTone, string> = {
  danger: 'bg-danger',
  warning: 'bg-gold-500',
  info: 'bg-admin-dot',
  quiet: 'bg-admin-muted',
};

/** The actions most days start with, behind the write access each needs. */
function QuickActions({ user }: { user: AdminUser }) {
  const content = canWrite(user.role, 'content');
  const campaigns = canWrite(user.role, 'campaigns');
  const leads = canRead(user.role, 'leads');
  return (
    <>
      {leads ? (
        <Link href="/admin/leads/" className={button('secondary')}>
          Open the inbox
        </Link>
      ) : null}
      {campaigns ? (
        <Link href="/admin/campaigns/new/" className={button(content ? 'secondary' : 'primary')}>
          New campaign
        </Link>
      ) : null}
      {content ? (
        <Link href="/admin/content/services/new/" className={button('primary')}>
          <PlusIcon className="size-4" />
          New service
        </Link>
      ) : null}
    </>
  );
}

/** The four headline figures this role can see, each linked to its screen. */
function Figures({ view }: { view: AdminOverview }) {
  const cards = [];
  if (view.leads) {
    const daily = view.leads.daily.map((day) => day.count);
    cards.push(
      <StatCard
        key="week"
        label="New leads, last 7 days"
        value={view.leads.week.current}
        delta={delta(view.leads.week)}
        note="vs the 7 days before"
        href="/admin/leads/?received=last-7-days"
        points={daily.slice(-14)}
      />,
      <StatCard
        key="month"
        label="Leads, last 30 days"
        value={view.leads.month.current}
        delta={delta(view.leads.month)}
        note="vs the 30 days before"
        href="/admin/leads/?received=last-30-days"
        points={daily}
      />,
    );
  }
  if (view.bookings) {
    cards.push(
      <StatCard
        key="calls"
        label="Calls in the next 7 days"
        value={view.bookings.next7Days}
        note={view.bookings.upcoming[0] ? `Next: ${callWhen(view.bookings.upcoming[0].startsAt, view.timeZone)}` : 'Nothing booked yet'}
        href="/admin/bookings/"
      />,
    );
  }
  if (view.audience) {
    cards.push(
      <StatCard
        key="audience"
        label="Active subscribers"
        value={view.audience.active}
        delta={view.audience.joined.current > 0 ? { text: `+${String(view.audience.joined.current)}`, tone: 'up' } : null}
        note={view.audience.joined.current > 0 ? 'joined in 30 days' : 'none joined in 30 days'}
        href="/admin/subscribers/"
      />,
    );
  }
  if (view.content) {
    for (const family of view.content.families) {
      if (cards.length >= 4) break;
      const words = FAMILY[family.kind];
      if (!words) continue;
      cards.push(
        <StatCard
          key={family.kind}
          label={`Published ${words.many}`}
          value={family.published}
          note={family.unpublished > 0 ? `${String(family.unpublished)} not published` : 'all published'}
          href={words.href}
        />,
      );
    }
  }
  if (view.media && cards.length < 4) {
    cards.push(<StatCard key="media" label="Images in the library" value={view.media.total} href="/admin/media/" />);
  }
  if (cards.length === 0) return null;
  return (
    <section aria-label="Headline figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {cards.slice(0, 4)}
    </section>
  );
}

const FAMILY: Record<string, { many: string; href: string; one: string }> = {
  service: { one: 'Service', many: 'services', href: '/admin/content/' },
  industry: { one: 'Industry', many: 'industries', href: '/admin/industries/' },
  'case-study': { one: 'Case study', many: 'case studies', href: '/admin/case-studies/' },
  'page-copy': { one: 'Page copy', many: 'page copy', href: '/admin/page-copy/' },
};

function LatestLeads({ view, wide }: { view: AdminOverview; wide: boolean }) {
  const leads = view.leads;
  if (!leads) return null;
  return (
    <Panel
      title="Latest leads"
      labelledBy="overview-latest"
      flush
      className={wide ? 'xl:col-span-12' : 'xl:col-span-8'}
      actions={
        <Link href="/admin/leads/" className={`${LINK} text-[13.5px]`}>
          Open the inbox →
        </Link>
      }
    >
      {leads.latest.length === 0 ? (
        <EmptyState title="No leads yet">Leads appear here the moment someone sends a form on the site.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className={`${TH} pl-4 sm:pl-6`}>
                  Name
                </th>
                <th scope="col" className={`${TH} max-sm:hidden`}>
                  Form
                </th>
                <th scope="col" className={TH}>
                  Status
                </th>
                <th scope="col" className={`${TH} pr-4 text-right sm:pr-6`}>
                  Received
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.latest.map((lead) => (
                <tr key={lead.id} className="relative transition-colors duration-150 hover:bg-admin-hover">
                  <td className={`${TD} pl-4 sm:pl-6`}>
                    <Link
                      href={`/admin/leads/?lead=${encodeURIComponent(lead.id)}`}
                      className="flex flex-col before:absolute before:inset-0"
                    >
                      <span className="font-semibold text-ink-invert">{lead.name}</span>
                      {lead.company ? <span className="text-[12.5px] text-admin-muted">{lead.company}</span> : null}
                    </Link>
                  </td>
                  <td className={`${TD} max-sm:hidden`}>
                    <span className={TAG}>{typeLabel(lead.type)}</span>
                  </td>
                  <td className={TD}>
                    <StatusPill status={lead.status} />
                  </td>
                  <td className={`${TD} pr-4 text-right tabular-nums sm:pr-6`}>{shortWhen(lead.createdAt, view.timeZone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function UpcomingCalls({ view, wide }: { view: AdminOverview; wide: boolean }) {
  const bookings = view.bookings;
  if (!bookings) return null;
  return (
    <Panel
      title="Upcoming calls"
      labelledBy="overview-calls"
      className={wide ? 'xl:col-span-12' : 'xl:col-span-4'}
      actions={
        <Link href="/admin/bookings/" className={`${LINK} text-[13.5px]`}>
          All bookings →
        </Link>
      }
    >
      {bookings.upcoming.length === 0 ? (
        <p className="text-[14px] text-ink-invert-muted">
          No calls booked yet. Visitors book from the consultation page, in the hours set under{' '}
          <Link href="/admin/bookings/availability/" className={LINK}>
            Availability
          </Link>
          .
        </p>
      ) : (
        <ul className="-my-1 flex flex-col gap-1">
          {bookings.upcoming.map((call) => {
            const date = dateParts(call.startsAt, view.timeZone);
            return (
              <li key={call.id}>
                <Link
                  href={`/admin/bookings/${encodeURIComponent(call.id)}/`}
                  className="group -mx-2 flex items-center gap-3.5 rounded-lg p-2 transition-colors duration-150 hover:bg-admin-hover"
                >
                  <span className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-admin-line bg-admin-sunken">
                    <span className="text-[10px] font-semibold tracking-[0.1em] text-gold-500 uppercase">{date.month}</span>
                    <span className="font-display text-[17px] leading-tight font-extrabold text-ink-invert">{date.day}</span>
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[14px] font-semibold text-ink-invert">{call.name}</span>
                    <span className="truncate text-[12.5px] text-admin-muted">
                      {date.time} · {call.type}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Pipeline({ view }: { view: AdminOverview }) {
  const leads = view.leads;
  if (!leads) return null;
  const total = LEAD_STATUSES.reduce((sum, status) => sum + leads.byStatus[status], 0);
  return (
    <Panel title="Pipeline" labelledBy="overview-pipeline" description={`${String(total)} ${total === 1 ? 'lead' : 'leads'} in all, by where they stand`}>
      <ul className="flex flex-col gap-3">
        {LEAD_STATUSES.map((status) => (
          <li key={status} className="flex flex-col gap-1.5">
            <Link
              href={`/admin/leads/?status=${status}&received=last-90-days`}
              className="flex items-center justify-between text-[13.5px] text-ink-invert-muted transition-colors duration-150 hover:text-ink-invert"
            >
              <span>{LEAD_STATUS_LABELS[status]}</span>
              <span className="font-semibold text-ink-invert tabular-nums">{leads.byStatus[status]}</span>
            </Link>
            <ShareBar share={total === 0 ? 0 : leads.byStatus[status] / total} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Channels({ view }: { view: AdminOverview }) {
  const leads = view.leads;
  if (!leads) return null;
  const top = leads.byChannel[0]?.count ?? 0;
  return (
    <Panel title="Where leads come from" labelledBy="overview-channels" description="The last 30 days, by the visit that sent them">
      {leads.byChannel.length === 0 ? (
        <p className="text-[14px] text-ink-invert-muted">No leads in the last 30 days.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {leads.byChannel.map((entry) => (
            <li key={entry.channel} className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-[13.5px] text-ink-invert-muted">
                <span>{LEAD_CHANNELS.find((channel) => channel.value === entry.channel)?.label ?? entry.channel}</span>
                <span className="font-semibold text-ink-invert tabular-nums">{entry.count}</span>
              </span>
              <ShareBar share={top === 0 ? 0 : entry.count / top} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RecentlyEdited({ view }: { view: AdminOverview }) {
  const content = view.content;
  if (!content) return null;
  return (
    <Panel title="Recently edited" labelledBy="overview-edited" description="The latest changes to the site's content">
      {content.recent.length === 0 ? (
        <p className="text-[14px] text-ink-invert-muted">Nothing has been edited yet.</p>
      ) : (
        <ul className="-mx-2 grid grid-cols-1 gap-x-6 md:grid-cols-2 xl:grid-cols-3">
          {content.recent.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-admin-hover"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[14px] font-semibold text-ink-invert">{item.title}</span>
                  <span className="text-[12.5px] text-admin-muted">
                    {FAMILY[item.kind]?.one ?? item.kind} · {shortWhen(item.updatedAt, view.timeZone)}
                  </span>
                </span>
                {item.status ? <span className="shrink-0 text-[12px] font-semibold text-ink-invert-muted capitalize">{item.status.toLowerCase()}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function LastCampaign({ view }: { view: AdminOverview }) {
  const campaigns = view.campaigns;
  if (!campaigns) return null;
  const last = campaigns.lastSent;
  const rate = (part: number): string =>
    last && last.recipients > 0 ? `${String(Math.round((part / last.recipients) * 100))}%` : '—';
  return (
    <Panel
      title="Email campaigns"
      labelledBy="overview-campaigns"
      description={`${String(campaigns.scheduled)} scheduled · ${String(campaigns.drafts)} ${campaigns.drafts === 1 ? 'draft' : 'drafts'}`}
      actions={
        <Link href="/admin/campaigns/" className={`${LINK} text-[13.5px]`}>
          Campaigns →
        </Link>
      }
    >
      {last ? (
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-ink-invert-muted">
            Last sent:{' '}
            <Link href={`/admin/campaigns/${encodeURIComponent(last.id)}/report/`} className={LINK}>
              {last.name}
            </Link>
            , {shortWhen(last.sentAt, view.timeZone)}
          </p>
          <dl className="grid grid-cols-3 gap-3">
            {[
              ['Delivered', rate(last.delivered)],
              ['Opened', rate(last.opened)],
              ['Clicked', rate(last.clicked)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-admin-line2 bg-admin-sunken px-3 py-2.5">
                <dt className="text-[12px] text-admin-muted">{label}</dt>
                <dd className="font-display text-[20px] font-extrabold text-ink-invert tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="text-[14px] text-ink-invert-muted">No campaign has been sent yet.</p>
      )}
    </Panel>
  );
}

/** Whether search engines may see the site, for an owner; null when this role cannot know. */
async function siteIndexing(user: AdminUser): Promise<boolean | null> {
  if (!canRead(user.role, 'settings')) return null;
  try {
    const view = await adminGet('/admin/settings', adminSettingsViewSchema);
    const row = view.settings.find((setting) => setting.key === SETTING_KEYS.siteIndexing);
    const parsed = siteIndexingSchema.safeParse(row?.value);
    return parsed.success ? parsed.data.index : false;
  } catch {
    return null;
  }
}

function dayLabel(day: string): string {
  if (!day) return '';
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Today's time, yesterday, or the date, on the business's clock. */
function shortWhen(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const dayOf = (value: Date): string => value.toLocaleDateString('en-CA', { timeZone });
  const now = new Date();
  if (dayOf(date) === dayOf(now)) {
    return `Today, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone })}`;
  }
  if (dayOf(date) === dayOf(new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone });
}

function callWhen(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone });
}

function dateParts(iso: string, timeZone: string): { month: string; day: string; time: string } {
  const date = new Date(iso);
  return {
    month: date.toLocaleDateString('en-GB', { month: 'short', timeZone }),
    day: date.toLocaleDateString('en-GB', { day: '2-digit', timeZone }),
    time: date.toLocaleString('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone }),
  };
}
