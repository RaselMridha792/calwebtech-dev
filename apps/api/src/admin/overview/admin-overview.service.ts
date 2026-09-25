import { eligibleWhere, suppressedEmails } from '@calwebtech/db';
import {
  BOOKING_SETTING_KEYS,
  DEFAULT_BOOKING_PAGE,
  LEAD_STATUSES,
  OVERVIEW_TREND_DAYS,
  PAGE_COPY_KEYS,
  PAGE_COPY_LABELS,
  addDays,
  bookingPageContentSchema,
  canRead,
  dayKeyOf,
  leadChannel,
  type AdminOverview,
  type AdminRole,
  type LeadChannel,
  type LeadStatus,
  type OverviewAudience,
  type OverviewBookings,
  type OverviewCampaigns,
  type OverviewContent,
  type OverviewLeads,
  type PageCopyKey,
} from '@calwebtech/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Leads that are still being worked, so a passed next action date is worth raising. */
const OPEN_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT'];

/** A booking that still holds its time. */
const LIVE_BOOKINGS = ['CONFIRMED', 'RESCHEDULED'] as const;

/**
 * The overview (docs/12-admin-dashboard.md, screen 1), read in one request.
 *
 * Each section is read only when the caller's role reaches the module it comes from, and is
 * null otherwise, so the permission matrix decides what the first screen shows exactly as it
 * decides what every other screen shows.
 */
@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async overview(role: AdminRole, now = new Date()): Promise<AdminOverview> {
    const timeZone = await this.timeZone();
    const [leads, bookings, audience, campaigns, content, media] = await Promise.all([
      canRead(role, 'leads') ? this.leads(now, timeZone) : null,
      canRead(role, 'bookings') ? this.bookings(now, timeZone) : null,
      canRead(role, 'subscribers') ? this.audience(now) : null,
      canRead(role, 'campaigns') ? this.campaigns() : null,
      canRead(role, 'content') ? this.content(now) : null,
      canRead(role, 'media') ? this.media() : null,
    ]);
    return { generatedAt: now.toISOString(), leads, bookings, audience, campaigns, content, media };
  }

  /** The booking page's timezone is the business's: the trend's days are its days. */
  private async timeZone(): Promise<string> {
    const page = await this.settings.get(BOOKING_SETTING_KEYS.page);
    const parsed = bookingPageContentSchema.safeParse(page ?? DEFAULT_BOOKING_PAGE);
    return parsed.success ? parsed.data.timeZone : 'UTC';
  }

  private async leads(now: Date, timeZone: string): Promise<OverviewLeads> {
    const lead = this.prisma.client.lead;
    const live = { deletedAt: null };
    const since = (days: number): Date => new Date(now.getTime() - days * DAY_MS);
    const between = (from: number, to: number) => ({ ...live, createdAt: { gte: since(from), lt: since(to) } });

    const [weekNow, weekBefore, monthNow, monthBefore, recent, statuses, latest, unassignedNew, overdue] =
      await Promise.all([
        lead.count({ where: { ...live, createdAt: { gte: since(7) } } }),
        lead.count({ where: between(14, 7) }),
        lead.count({ where: { ...live, createdAt: { gte: since(OVERVIEW_TREND_DAYS) } } }),
        lead.count({ where: between(OVERVIEW_TREND_DAYS * 2, OVERVIEW_TREND_DAYS) }),
        lead.findMany({
          where: { ...live, createdAt: { gte: since(OVERVIEW_TREND_DAYS) } },
          select: { createdAt: true, attribution: { select: { lastTouchUtm: true, referrer: true } } },
        }),
        lead.groupBy({ by: ['status'], where: live, _count: { _all: true } }),
        lead.findMany({
          where: live,
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, name: true, company: true, type: true, status: true, createdAt: true },
        }),
        lead.count({ where: { ...live, ownerId: null, status: 'NEW' } }),
        lead.count({ where: { ...live, status: { in: OPEN_STATUSES }, nextActionDate: { lt: now } } }),
      ]);

    // Thirty calendar days in the business timezone, today last, every day present.
    const today = dayKeyOf(now, timeZone);
    const days = Array.from({ length: OVERVIEW_TREND_DAYS }, (_, index) =>
      addDays(today, index - (OVERVIEW_TREND_DAYS - 1)),
    );
    const perDay = new Map(days.map((day) => [day, 0]));
    const perChannel = new Map<LeadChannel, number>();
    for (const row of recent) {
      const day = dayKeyOf(row.createdAt, timeZone);
      const seen = perDay.get(day);
      if (seen !== undefined) perDay.set(day, seen + 1);
      const utm = row.attribution?.lastTouchUtm as { source?: string | null; medium?: string | null } | null;
      const channel = leadChannel(utm ?? null, row.attribution?.referrer ?? null);
      perChannel.set(channel, (perChannel.get(channel) ?? 0) + 1);
    }

    const byStatus = Object.fromEntries(LEAD_STATUSES.map((status) => [status, 0])) as Record<LeadStatus, number>;
    for (const row of statuses) byStatus[row.status] = row._count._all;

    return {
      week: { current: weekNow, previous: weekBefore },
      month: { current: monthNow, previous: monthBefore },
      daily: days.map((day) => ({ day, count: perDay.get(day) ?? 0 })),
      byStatus,
      byChannel: [...perChannel.entries()]
        .map(([channel, count]) => ({ channel, count }))
        .sort((a, b) => b.count - a.count),
      latest: latest.map((row) => ({
        id: row.id,
        name: row.name,
        company: row.company,
        type: row.type,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
      unassignedNew,
      overdue,
    };
  }

  private async bookings(now: Date, timeZone: string): Promise<OverviewBookings> {
    const live = { status: { in: [...LIVE_BOOKINGS] }, startsAt: { gte: now } };
    const [upcoming, next7Days] = await Promise.all([
      this.prisma.client.booking.findMany({
        where: live,
        orderBy: { startsAt: 'asc' },
        take: 5,
        select: { id: true, name: true, startsAt: true, consultationType: { select: { name: true } } },
      }),
      this.prisma.client.booking.count({
        where: { ...live, startsAt: { gte: now, lt: new Date(now.getTime() + 7 * DAY_MS) } },
      }),
    ]);
    return {
      upcoming: upcoming.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.consultationType.name,
        startsAt: row.startsAt.toISOString(),
      })),
      next7Days,
      timeZone,
    };
  }

  private async audience(now: Date): Promise<OverviewAudience> {
    const subscriber = this.prisma.client.subscriber;
    const suppressed = await suppressedEmails(this.prisma.client);
    const since = (days: number): Date => new Date(now.getTime() - days * DAY_MS);
    const [active, joinedNow, joinedBefore] = await Promise.all([
      subscriber.count({ where: eligibleWhere(suppressed) }),
      subscriber.count({ where: { createdAt: { gte: since(OVERVIEW_TREND_DAYS) } } }),
      subscriber.count({ where: { createdAt: { gte: since(OVERVIEW_TREND_DAYS * 2), lt: since(OVERVIEW_TREND_DAYS) } } }),
    ]);
    return { active, joined: { current: joinedNow, previous: joinedBefore }, suppressed: suppressed.length };
  }

  private async campaigns(): Promise<OverviewCampaigns> {
    const campaign = this.prisma.client.campaign;
    const [drafts, scheduled, last] = await Promise.all([
      campaign.count({ where: { status: 'DRAFT' } }),
      campaign.count({ where: { status: 'SCHEDULED' } }),
      campaign.findFirst({
        where: { status: 'SENT', sentAt: { not: null } },
        orderBy: { sentAt: 'desc' },
        select: { id: true, name: true, sentAt: true },
      }),
    ]);
    if (!last?.sentAt) return { drafts, scheduled, lastSent: null };

    const recipient = this.prisma.client.campaignRecipient;
    const mine = { campaignId: last.id };
    const [recipients, delivered, opened, clicked] = await Promise.all([
      recipient.count({ where: { ...mine, sentAt: { not: null } } }),
      recipient.count({ where: { ...mine, deliveredAt: { not: null } } }),
      recipient.count({ where: { ...mine, openedAt: { not: null } } }),
      recipient.count({ where: { ...mine, clickedAt: { not: null } } }),
    ]);
    return {
      drafts,
      scheduled,
      lastSent: { id: last.id, name: last.name, sentAt: last.sentAt.toISOString(), recipients, delivered, opened, clicked },
    };
  }

  private async content(now: Date): Promise<OverviewContent> {
    const { service, industry, project, setting } = this.prisma.client;
    const live = { deletedAt: null };
    const recentSelect = { id: true, status: true, updatedAt: true } as const;

    const [services, industries, projects, services6, industries6, projects6, copy, scheduledPast] =
      await Promise.all([
        service.groupBy({ by: ['status'], where: live, _count: { _all: true } }),
        industry.groupBy({ by: ['status'], where: live, _count: { _all: true } }),
        project.groupBy({ by: ['status'], where: live, _count: { _all: true } }),
        service.findMany({ where: live, orderBy: { updatedAt: 'desc' }, take: 6, select: { ...recentSelect, title: true } }),
        industry.findMany({ where: live, orderBy: { updatedAt: 'desc' }, take: 6, select: { ...recentSelect, name: true } }),
        project.findMany({ where: live, orderBy: { updatedAt: 'desc' }, take: 6, select: { ...recentSelect, title: true } }),
        setting.findMany({
          where: { key: { in: [...PAGE_COPY_KEYS] } },
          orderBy: { updatedAt: 'desc' },
          take: 6,
          select: { key: true, updatedAt: true },
        }),
        // Only a service carries a publish time, so only a service can be overdue.
        service.count({ where: { ...live, status: 'SCHEDULED', publishedAt: { lt: now } } }),
      ]);

    const family = (kind: OverviewContent['families'][number]['kind'], rows: { status: string; _count: { _all: number } }[]) => {
      const published = rows.find((row) => row.status === 'PUBLISHED')?._count._all ?? 0;
      const total = rows.reduce((sum, row) => sum + row._count._all, 0);
      return { kind, published, unpublished: total - published };
    };

    const recent: OverviewContent['recent'] = [
      ...services6.map((row) => ({
        kind: 'service' as const,
        title: row.title,
        href: `/admin/content/services/${row.id}/`,
        status: row.status,
        updatedAt: row.updatedAt,
      })),
      ...industries6.map((row) => ({
        kind: 'industry' as const,
        title: row.name,
        href: `/admin/industries/${row.id}/`,
        status: row.status,
        updatedAt: row.updatedAt,
      })),
      ...projects6.map((row) => ({
        kind: 'case-study' as const,
        title: row.title,
        href: `/admin/case-studies/${row.id}/`,
        status: row.status,
        updatedAt: row.updatedAt,
      })),
      ...copy.map((row) => ({
        kind: 'page-copy' as const,
        title: PAGE_COPY_LABELS[row.key as PageCopyKey].title,
        href: `/admin/page-copy/${row.key}/`,
        status: null,
        updatedAt: row.updatedAt,
      })),
    ]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 6)
      .map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));

    return {
      families: [
        family('service', services),
        family('industry', industries),
        family('case-study', projects),
      ],
      recent,
      scheduledPast,
    };
  }

  private async media(): Promise<{ total: number }> {
    return { total: await this.prisma.client.mediaAsset.count({ where: { deletedAt: null } }) };
  }
}
