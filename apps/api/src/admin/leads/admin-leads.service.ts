import {
  CLOSED_LEAD_STATUSES,
  LEAD_STATUSES,
  leadChannel,
  type AdminLeadAttribution,
  type AdminLeadDetail,
  type AdminLeadEmail,
  type AdminLeadFilterOptions,
  type AdminLeadList,
  type AdminLeadListItem,
  type AdminLeadQuery,
  type AdminLeadTimelineEntry,
  type LeadBulk,
  type LeadChannel,
  type LeadNoteCreate,
  type LeadPipelineUpdate,
  type LeadStatus,
} from '@calwebtech/shared';
import type { Prisma } from '@calwebtech/db';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../auth/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Who is making the change, for the activity trail and the audit log. */
export interface Actor {
  id: string;
  ip: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The mediums that mean money was spent, which is the only paid/organic signal we keep. */
const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paidsocial', 'paid-social', 'paid_social', 'display'];

const LIST_SELECT = {
  id: true,
  type: true,
  status: true,
  name: true,
  email: true,
  company: true,
  budgetBand: true,
  value: true,
  nextActionDate: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { title: true } },
  owner: { select: { id: true, name: true } },
  attribution: { select: { lastTouchUtm: true, referrer: true, campaignPage: { select: { name: true } } } },
} as const;

type WhereFragment = Record<string, unknown>;

@Injectable()
export class AdminLeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * One page of the inbox, plus the status counts for the same filters so the tabs can be
   * numbered without a second round trip. Soft-deleted leads are never returned.
   */
  async list(query: AdminLeadQuery, callerId: string): Promise<AdminLeadList> {
    const where = this.buildWhere(query, callerId);
    const withoutStatus = this.buildWhere({ ...query, status: undefined }, callerId);

    const [rows, total, counts, unassignedNew] = await Promise.all([
      this.prisma.client.lead.findMany({
        where,
        orderBy: this.orderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: LIST_SELECT,
      }),
      this.prisma.client.lead.count({ where }),
      // Counted without the status filter, or every tab but the selected one reads zero.
      this.prisma.client.lead.groupBy({ by: ['status'], where: withoutStatus, _count: { _all: true } }),
      this.prisma.client.lead.count({ where: { ...where, ownerId: null, status: 'NEW' } }),
    ]);

    const statusCounts = Object.fromEntries(LEAD_STATUSES.map((status) => [status, 0])) as Record<LeadStatus, number>;
    for (const row of counts) statusCounts[row.status] = row._count._all;

    return {
      items: rows.map(toListItem),
      total,
      page: query.page,
      pageSize: query.pageSize,
      statusCounts,
      unassignedNew,
    };
  }

  /**
   * What the filter bar's selects offer. Read from the database so a new service, campaign
   * or enquiry type appears without a deploy, which is the whole point of the admin.
   */
  async filterOptions(): Promise<AdminLeadFilterOptions> {
    const [owners, services, campaigns, enquiryTypes] = await Promise.all([
      this.prisma.client.user.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.client.service.findMany({
        where: { deletedAt: null },
        orderBy: { title: 'asc' },
        select: { slug: true, title: true },
      }),
      this.prisma.client.landingPage.findMany({ orderBy: { name: 'asc' }, select: { slug: true, name: true } }),
      this.prisma.client.enquiryType.findMany({ orderBy: { order: 'asc' }, select: { slug: true, name: true } }),
    ]);
    return { owners, services, campaigns, enquiryTypes };
  }

  /** The full record with its attribution trail and timeline, or null when there is none. */
  async detail(id: string): Promise<AdminLeadDetail | null> {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...LIST_SELECT,
        phone: true,
        message: true,
        timeline: true,
        projectType: true,
        siteUrl: true,
        serviceInterest: true,
        referralSource: true,
        answers: true,
        consentAt: true,
        contact: { select: { id: true, name: true, _count: { select: { leads: true } } } },
        attribution: {
          select: {
            firstTouchUtm: true,
            lastTouchUtm: true,
            referrer: true,
            landingPage: true,
            device: true,
            formId: true,
            campaignPage: { select: { name: true } },
          },
        },
        activities: { orderBy: { createdAt: 'desc' }, select: { id: true, type: true, detail: true, createdAt: true } },
        notes: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, body: true, createdAt: true, user: { select: { id: true, name: true } } },
        },
        uploads: { select: { id: true, url: true, filename: true, sizeBytes: true } },
      },
    });
    if (!lead) return null;

    const entries: AdminLeadTimelineEntry[] = [
      ...lead.activities.map((activity) => ({
        kind: 'activity' as const,
        id: activity.id,
        type: activity.type,
        detail: activity.detail ?? null,
        createdAt: activity.createdAt.toISOString(),
      })),
      ...lead.notes.map((note) => ({
        kind: 'note' as const,
        id: note.id,
        body: note.body,
        author: note.user ? { id: note.user.id, name: note.user.name } : null,
        createdAt: note.createdAt.toISOString(),
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      ...toListItem(lead),
      phone: lead.phone,
      message: lead.message,
      timeline: lead.timeline,
      projectType: lead.projectType,
      siteUrl: lead.siteUrl,
      serviceInterest: lead.serviceInterest,
      referralSource: lead.referralSource,
      answers: lead.answers ?? null,
      consentAt: lead.consentAt?.toISOString() ?? null,
      contact: lead.contact
        ? { id: lead.contact.id, name: lead.contact.name, submissions: lead.contact._count.leads }
        : null,
      attribution: toAttribution(lead.attribution),
      entries,
      emails: await this.emailsFor(lead.email),
      uploads: lead.uploads,
    };
  }

  /**
   * The pipeline block saves as one change: status, owner and next action date together.
   *
   * Each part that actually moves is written as an activity as well as an audit entry. The
   * audit log answers "who changed what" across the admin, while the timeline answers "what
   * happened to this lead", which is what the inbox shows.
   */
  async updatePipeline(id: string, input: LeadPipelineUpdate, actor: Actor): Promise<AdminLeadDetail> {
    const before = await this.requireLead(id);

    // Someone else moved it while this panel was open. Refusing is better than silently
    // overwriting a decision the caller never saw.
    if (input.expectedStatus && input.expectedStatus !== before.status) {
      throw new ConflictException({
        error: 'stale_status',
        message: `This lead is now ${before.status}. Reload before saving.`,
      });
    }

    if (input.ownerId) {
      const owner = await this.prisma.client.user.findFirst({
        where: { id: input.ownerId, deletedAt: null },
        select: { id: true },
      });
      if (!owner) {
        throw new BadRequestException({ error: 'validation_failed', fieldErrors: { ownerId: ['No such active user'] } });
      }
    }

    const data: Record<string, unknown> = {};
    const activities: { type: string; detail: Prisma.InputJsonObject }[] = [];

    if (input.status !== undefined && input.status !== before.status) {
      data.status = input.status;
      activities.push({
        type: 'status_change',
        detail: { from: before.status, to: input.status, reason: input.reason ?? null, by: actor.id },
      });
    }
    if (input.ownerId !== undefined && input.ownerId !== before.ownerId) {
      data.ownerId = input.ownerId;
      activities.push({ type: 'owner_changed', detail: { from: before.ownerId, to: input.ownerId, by: actor.id } });
    }
    if (input.nextActionDate !== undefined) {
      const next = input.nextActionDate ? new Date(`${input.nextActionDate}T00:00:00.000Z`) : null;
      if ((next?.getTime() ?? null) !== (before.nextActionDate?.getTime() ?? null)) {
        data.nextActionDate = next;
        activities.push({ type: 'next_action_set', detail: { to: input.nextActionDate ?? null, by: actor.id } });
      }
    }

    if (Object.keys(data).length === 0) return this.requireDetail(id);

    await this.prisma.client.$transaction([
      this.prisma.client.lead.update({ where: { id }, data }),
      ...activities.map((activity) => this.prisma.client.leadActivity.create({ data: { leadId: id, ...activity } })),
    ]);
    await this.audit.record({
      userId: actor.id,
      action: 'lead.pipeline_updated',
      entityType: 'Lead',
      entityId: id,
      before: {
        status: before.status,
        ownerId: before.ownerId,
        nextActionDate: before.nextActionDate?.toISOString() ?? null,
      },
      after: { ...data, reason: input.reason ?? null },
      ip: actor.ip,
    });
    return this.requireDetail(id);
  }

  async addNote(id: string, input: LeadNoteCreate, actor: Actor): Promise<AdminLeadDetail> {
    await this.requireLead(id);
    await this.prisma.client.leadNote.create({ data: { leadId: id, userId: actor.id, body: input.body } });
    await this.audit.record({
      userId: actor.id,
      action: 'lead.note_added',
      entityType: 'Lead',
      entityId: id,
      ip: actor.ip,
    });
    return this.requireDetail(id);
  }

  /**
   * The listing's bulk actions. Applied one lead at a time rather than as a single UPDATE,
   * so every row gets its own activity and audit entry and the trail stays per-lead. Ids
   * that name nothing are skipped rather than failing the batch.
   */
  async bulk(input: LeadBulk, actor: Actor): Promise<{ updated: number }> {
    if (input.status === undefined && input.ownerId === undefined) {
      throw new BadRequestException({
        error: 'validation_failed',
        fieldErrors: { _form: ['Choose a status or an owner to apply'] },
      });
    }
    let updated = 0;
    for (const id of input.ids) {
      const lead = await this.prisma.client.lead.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!lead) continue;
      await this.updatePipeline(id, { status: input.status, ownerId: input.ownerId, reason: input.reason }, actor);
      updated += 1;
    }
    return { updated };
  }

  /**
   * The current filter as CSV. Exporting is audited because it takes lead addresses out of
   * the system, which is where our data-ownership promise stops covering them.
   */
  async exportCsv(query: AdminLeadQuery, actor: Actor): Promise<string> {
    const rows = await this.prisma.client.lead.findMany({
      where: this.buildWhere(query, actor.id),
      orderBy: this.orderBy(query),
      // Bounded, so one click cannot try to serialise the whole table into memory.
      take: 5000,
      select: { ...LIST_SELECT, phone: true, message: true, referralSource: true },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'lead.exported',
      entityType: 'Lead',
      after: { rows: rows.length, filters: query },
      ip: actor.ip,
    });

    const header = [
      'id',
      'received',
      'type',
      'status',
      'name',
      'email',
      'phone',
      'company',
      'source',
      'channel',
      'owner',
      'budget band',
      'next action',
      'referral',
      'message',
    ];
    const lines = rows.map((row) => {
      const item = toListItem(row);
      return [
        item.id,
        item.createdAt,
        item.type,
        item.status,
        item.name,
        item.email,
        row.phone ?? '',
        item.company ?? '',
        item.source ?? '',
        item.channel,
        item.owner?.name ?? '',
        item.budgetBand ?? '',
        item.nextActionDate ?? '',
        row.referralSource ?? '',
        row.message ?? '',
      ]
        .map(csvCell)
        .join(',');
    });
    return [header.join(','), ...lines].join('\r\n');
  }

  /**
   * `EmailEvent` is keyed by address, not by lead, so this matches on the address. Nothing
   * writes those rows until the Resend webhooks exist (Task 6.2), so today this is empty and
   * the panel says so rather than pretending no email was ever sent.
   */
  private async emailsFor(email: string): Promise<AdminLeadEmail[]> {
    const events = await this.prisma.client.emailEvent.findMany({
      where: { email },
      orderBy: { occurredAt: 'desc' },
      take: 20,
      select: { id: true, email: true, type: true, payload: true, occurredAt: true },
    });
    return events.map((event) => ({
      id: event.id,
      subject: readSubject(event.payload),
      to: event.email,
      state: event.type,
      occurredAt: event.occurredAt.toISOString(),
    }));
  }

  private async requireLead(
    id: string,
  ): Promise<{ status: LeadStatus; ownerId: string | null; nextActionDate: Date | null }> {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id, deletedAt: null },
      select: { status: true, ownerId: true, nextActionDate: true },
    });
    if (!lead) throw new NotFoundException();
    return lead;
  }

  private async requireDetail(id: string): Promise<AdminLeadDetail> {
    const detail = await this.detail(id);
    if (!detail) throw new NotFoundException();
    return detail;
  }

  private buildWhere(query: Partial<AdminLeadQuery>, callerId: string): WhereFragment {
    const status = query.status?.length
      ? { in: query.status }
      : query.includeClosed
        ? undefined
        : { notIn: [...CLOSED_LEAD_STATUSES] };

    // `me` and `unassigned` are the two the UI needs and an id cannot express.
    const owner =
      query.owner === undefined
        ? undefined
        : query.owner === 'unassigned'
          ? null
          : query.owner === 'me'
            ? callerId
            : query.owner;

    const range = dateRange(query.received, query.from, query.to);

    return {
      deletedAt: null,
      ...(query.ids?.length ? { id: { in: query.ids } } : {}),
      ...(query.type?.length ? { type: { in: query.type } } : {}),
      ...(status ? { status } : {}),
      ...(owner === undefined ? {} : { ownerId: owner }),
      ...(query.serviceSlug ? { service: { slug: query.serviceSlug } } : {}),
      ...(query.campaignSlug ? { attribution: { campaignPage: { slug: query.campaignSlug } } } : {}),
      // The enquiry type has no column: it is written into `answers` beside the lead
      // (apps/api/src/leads/leads.service.ts), and only a CONTACT lead carries one.
      ...(query.enquiry ? { answers: { path: ['enquiryType'], equals: query.enquiry } } : {}),
      ...(range ? { createdAt: range } : {}),
      ...(query.source ? channelWhere(query.source) : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { company: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  /** One column, one direction, matching the header buttons. */
  private orderBy(query: Pick<AdminLeadQuery, 'sort' | 'dir'>): Record<string, unknown> {
    const dir = query.dir;
    switch (query.sort) {
      case 'name':
        return { name: dir };
      case 'company':
        return { company: { sort: dir, nulls: 'last' } };
      case 'type':
        return { type: dir };
      case 'service':
        return { service: { title: dir } };
      case 'status':
        return { status: dir };
      case 'owner':
        return { owner: { name: dir } };
      case 'value':
        // The money column shows the band; it sorts by the figure behind it, and leads with
        // no figure sort last whichever way the column is pointing.
        return { value: { sort: dir, nulls: 'last' } };
      default:
        return { createdAt: dir };
    }
  }
}

/**
 * The Received presets. `custom` uses the explicit `from` and `to`; everything else is a
 * window ending now, so a lead received a minute ago is in "Today" wherever the server is.
 */
function dateRange(
  received: AdminLeadQuery['received'],
  from: string | undefined,
  to: string | undefined,
): Record<string, Date> | undefined {
  if (received === 'custom' || (!received && (from ?? to))) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(`${from}T00:00:00.000Z`);
    // Exclusive of the day after, which is how a person picking an end date means it.
    if (to) range.lt = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + DAY_MS);
    return Object.keys(range).length > 0 ? range : undefined;
  }
  const now = new Date();
  switch (received) {
    case 'today': {
      const start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);
      return { gte: start };
    }
    case 'last-7-days':
      return { gte: new Date(now.getTime() - 7 * DAY_MS) };
    case 'last-30-days':
      return { gte: new Date(now.getTime() - 30 * DAY_MS) };
    case 'this-quarter':
      return { gte: new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1)) };
    case 'last-90-days':
      return { gte: new Date(now.getTime() - 90 * DAY_MS) };
    default:
      return undefined;
  }
}

/**
 * The channel filter, expressed against what is actually stored: the UTM set and the
 * referrer. The paid and organic halves of one source are told apart by `utm_medium`, which
 * is the only signal we keep. `referral` and `direct` are approximations — a visit with a
 * referrer and no campaign, and one with neither — because nothing records a session's whole
 * history; `leadChannel` in packages/shared labels a row the same way.
 */
function channelWhere(channel: LeadChannel): WhereFragment {
  const paid = { OR: PAID_MEDIUMS.map((medium) => utmPath('medium', medium)) };
  const source = (value: string): WhereFragment => ({
    attribution: { lastTouchUtm: { path: ['source'], string_contains: value } },
  });

  switch (channel) {
    case 'google-paid':
      return { AND: [source('google'), paid] };
    case 'google-organic':
      return { AND: [source('google'), { NOT: paid }] };
    case 'linkedin-paid':
      return { AND: [source('linkedin'), paid] };
    case 'linkedin-organic':
      return { AND: [source('linkedin'), { NOT: paid }] };
    case 'instagram':
      return source('instagram');
    case 'newsletter':
      return { OR: [source('newsletter'), utmPath('medium', 'email')] };
    case 'referral':
      return { attribution: { referrer: { not: null } } };
    default:
      return { OR: [{ attribution: null }, { attribution: { referrer: null } }] };
  }
}

function utmPath(key: string, value: string): WhereFragment {
  return { attribution: { lastTouchUtm: { path: [key], equals: value } } };
}

interface ListRow {
  id: string;
  type: string;
  status: string;
  name: string;
  email: string;
  company: string | null;
  budgetBand: string | null;
  value: unknown;
  nextActionDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  service: { title: string } | null;
  owner: { id: string; name: string } | null;
  attribution: { lastTouchUtm: unknown; referrer: string | null; campaignPage: { name: string } | null } | null;
}

function toListItem(row: ListRow): AdminLeadListItem {
  const utm = row.attribution?.lastTouchUtm as { source?: string | null; medium?: string | null } | null;
  return {
    id: row.id,
    type: row.type as AdminLeadListItem['type'],
    status: row.status as LeadStatus,
    name: row.name,
    email: row.email,
    company: row.company,
    // The service the enquiry named, else the campaign it arrived through.
    source: row.service?.title ?? row.attribution?.campaignPage?.name ?? null,
    channel: leadChannel(utm ?? null, row.attribution?.referrer ?? null),
    budgetBand: row.budgetBand,
    // Decimal, so it arrives as an object rather than a number until it is converted.
    value: row.value === null || row.value === undefined ? null : Number(row.value),
    owner: row.owner,
    nextActionDate: row.nextActionDate?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAttribution(
  row: {
    firstTouchUtm: unknown;
    lastTouchUtm: unknown;
    referrer: string | null;
    landingPage: string | null;
    device: string | null;
    formId: string | null;
    campaignPage: { name: string } | null;
  } | null,
): AdminLeadAttribution | null {
  if (!row) return null;
  return {
    firstTouch: row.firstTouchUtm ?? null,
    lastTouch: row.lastTouchUtm ?? null,
    referrer: row.referrer,
    landingPage: row.landingPage,
    device: row.device,
    formId: row.formId,
    campaign: row.campaignPage?.name ?? null,
  };
}

/** The subject is only in the provider's payload; an em dash where the payload has none. */
function readSubject(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'subject' in payload) {
    const subject = (payload as { subject?: unknown }).subject;
    if (typeof subject === 'string' && subject.length > 0) return subject;
  }
  return '—';
}

/** RFC 4180: quote when the value could otherwise break the row or the column. */
function csvCell(value: string): string {
  const flattened = value.replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(flattened) ? `"${flattened.replace(/"/g, '""')}"` : flattened;
}
