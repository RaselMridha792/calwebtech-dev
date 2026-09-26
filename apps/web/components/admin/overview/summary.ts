import { periodChange, type AdminOverview, type OverviewPeriod } from '@calwebtech/shared';
import type { DeltaTone } from '../ui/charts';

/*
 * The overview's words, worked out from its figures: the greeting, the one sentence under
 * it, and the list of things waiting on someone. Pure functions, so the page stays a
 * layout and these are tested on their own.
 */

export type AttentionTone = 'info' | 'warning' | 'danger' | 'quiet';

export interface AttentionItem {
  title: string;
  note: string;
  href: string;
  tone: AttentionTone;
}

/** Morning, afternoon or evening on the business's clock. */
export function greeting(now: Date, timeZone: string, name: string): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now));
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = name.split(/[\s-]+/).find(Boolean) ?? name;
  return `${part}, ${first}`;
}

export function todayLine(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(now);
}

const plural = (count: number, one: string, many: string): string => `${String(count)} ${count === 1 ? one : many}`;

/** The one sentence under the greeting: the most useful thing the figures say. */
export function summaryLine(view: AdminOverview): string {
  const parts: string[] = [];
  if (view.leads && view.leads.unassignedNew > 0) {
    parts.push(
      `${plural(view.leads.unassignedNew, 'new lead is', 'new leads are')} waiting for an owner`,
    );
  }
  if (view.bookings && view.bookings.next7Days > 0) {
    parts.push(`${plural(view.bookings.next7Days, 'call is', 'calls are')} booked in the next seven days`);
  }
  if (parts.length === 0 && view.content) {
    const drafts = view.content.families.reduce((sum, family) => sum + family.unpublished, 0);
    if (drafts > 0) parts.push(`${plural(drafts, 'page is', 'pages are')} not published yet`);
  }
  if (parts.length === 0) return 'Everything is up to date. Here is how the site is doing.';
  return `${parts.join(', and ')}.`.replace(/^./, (first) => first.toUpperCase());
}

/** A period's change as the stat card shows it, or null when there is nothing to compare. */
export function delta(period: OverviewPeriod): { text: string; tone: DeltaTone } | null {
  const change = periodChange(period);
  if (change === null) return period.current > 0 ? { text: 'New', tone: 'up' } : null;
  if (change === 0) return { text: 'Level', tone: 'flat' };
  return { text: `${String(Math.abs(change))}%`, tone: change > 0 ? 'up' : 'down' };
}

/**
 * What is waiting on someone, most pressing first. Each item is a sentence and a link to
 * the screen where it is dealt with; an empty list is its own good news.
 */
export function attention(view: AdminOverview, indexing: boolean | null): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { leads, content, campaigns } = view;

  if (leads && leads.overdue > 0) {
    items.push({
      title: `${plural(leads.overdue, 'follow-up is', 'follow-ups are')} overdue`,
      note: 'The next action date has passed',
      href: '/admin/leads/',
      tone: 'danger',
    });
  }
  if (leads && leads.unassignedNew > 0) {
    items.push({
      title: `${plural(leads.unassignedNew, 'new lead has', 'new leads have')} no owner`,
      note: 'Give each one to someone from the inbox',
      href: '/admin/leads/?status=NEW&owner=unassigned',
      tone: 'info',
    });
  }
  if (content && content.scheduledPast > 0) {
    items.push({
      title: `${plural(content.scheduledPast, 'scheduled service has', 'scheduled services have')} passed its time`,
      note: 'Publish it, or set a new date',
      href: '/admin/content/',
      tone: 'warning',
    });
  }
  if (content) {
    const labels: Record<string, [string, string, string]> = {
      service: ['service', 'services', '/admin/content/'],
      industry: ['industry', 'industries', '/admin/industries/'],
      'case-study': ['case study', 'case studies', '/admin/case-studies/'],
    };
    for (const family of content.families) {
      const words = labels[family.kind];
      if (!words || family.unpublished === 0) continue;
      items.push({
        title: `${plural(family.unpublished, `${words[0]} is`, `${words[1]} are`)} not published`,
        note: 'Visitors cannot see them until they are',
        href: words[2],
        tone: 'warning',
      });
    }
  }
  if (campaigns && campaigns.drafts > 0) {
    items.push({
      title: `${plural(campaigns.drafts, 'campaign is', 'campaigns are')} still a draft`,
      note: 'Finish and schedule, or delete',
      href: '/admin/campaigns/?status=DRAFT',
      tone: 'quiet',
    });
  }
  if (indexing === false) {
    items.push({
      title: 'Search engines cannot see the site',
      note: 'Turn it on in Settings once the content is real',
      href: '/admin/settings/',
      tone: 'quiet',
    });
  }
  return items;
}
