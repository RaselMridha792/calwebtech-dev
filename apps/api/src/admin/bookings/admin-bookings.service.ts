import { Prisma } from '@calwebtech/db';
import {
  BOOKING_ERRORS,
  BOOKING_HORIZON_DAYS,
  BOOKING_SETTING_KEYS,
  type AdminAvailability,
  type AdminAvailabilityUpdate,
  type AdminBooking,
  type AdminBookingDetail,
  type AdminBookingList,
  type AdminBookingQuery,
  type AdminBookingUpdate,
  adminAvailabilitySchema,
  adminBookingDetailSchema,
  adminBookingListSchema,
  bookingPageContentSchema,
} from '@calwebtech/shared';
import { ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { AuditService } from '../../auth/audit.service';
import { reminderJobIds } from '../../booking/booking-reminders';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailQueue } from '../../queue/email-queue';
import { SettingsService } from '../../settings/settings.service';

const WITH_TYPE = {
  consultationType: { select: { name: true, durationMinutes: true } },
} satisfies Prisma.BookingInclude;

type BookingRecord = Prisma.BookingGetPayload<{ include: typeof WITH_TYPE }>;

function toView(booking: BookingRecord): AdminBooking {
  return {
    id: booking.id,
    name: booking.name,
    email: booking.email,
    phone: booking.phone,
    timezone: booking.timezone,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    status: booking.status,
    consultationType: booking.consultationType,
    context: booking.context,
    notes: booking.notes,
    createdAt: booking.createdAt.toISOString(),
    leadId: booking.leadId,
  };
}

/**
 * The bookings module of the dashboard (docs/12-admin-dashboard.md).
 *
 * The default view is what is still to come: a call that has happened is history, and a
 * screen that opens on six months of it hides the two calls this week. Past and all are a
 * click away.
 */
@Injectable()
export class AdminBookingsService {
  private readonly logger = new Logger(AdminBookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    /** Takes a closed call's reminders off the queue. Optional where no queue is wired, as in tests. */
    @Optional() private readonly emailQueue?: EmailQueue,
  ) {}

  async list(query: AdminBookingQuery): Promise<AdminBookingList> {
    const now = new Date();
    const where: Prisma.BookingWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.when === 'upcoming' ? { startsAt: { gte: now } } : {}),
      ...(query.when === 'past' ? { startsAt: { lt: now } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.booking.findMany({
        where,
        include: WITH_TYPE,
        // Soonest first when looking forward, most recent first when looking back.
        orderBy: { startsAt: query.when === 'past' ? 'desc' : 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.booking.count({ where }),
    ]);

    return adminBookingListSchema.parse({
      items: items.map(toView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async find(id: string): Promise<AdminBookingDetail> {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id },
      include: { ...WITH_TYPE, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!booking) throw new NotFoundException();
    return adminBookingDetailSchema.parse({
      ...toView(booking),
      events: booking.events.map((event) => ({
        id: event.id,
        type: event.type,
        createdAt: event.createdAt.toISOString(),
      })),
    });
  }

  /**
   * Where a booking stands, and what was said. A status change writes an event, so the
   * detail screen shows how a call reached the state it is in rather than only the state.
   */
  async update(id: string, input: AdminBookingUpdate, actorId: string): Promise<AdminBookingDetail> {
    const before = await this.prisma.client.booking.findUnique({
      where: { id },
      select: { status: true, startsAt: true },
    });
    if (!before) throw new NotFoundException();

    // A cancelled call gives its time back, and one brought back takes it again — refused if
    // somebody has booked it since (the unique index on the held slot).
    const holds = input.status ? input.status !== 'CANCELLED' : undefined;
    try {
      await this.transitionTo(id, input, before, holds);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          error: BOOKING_ERRORS.slotGone,
          message: 'Somebody else has booked that time since the call was cancelled.',
        });
      }
      throw error;
    }


    // A call the team cancels or closes is not reminded about (docs/08-decisions.md, 60). The
    // worker checks again before sending, so a removal that fails here reminds nobody either.
    if (input.status && !['CONFIRMED', 'RESCHEDULED'].includes(input.status) && this.emailQueue) {
      await this.emailQueue.remove(reminderJobIds({ id, startsAt: before.startsAt })).catch((error: unknown) => {
        this.logger.warn(`Booking ${id}: its reminders could not be removed; the worker will skip them.`, error);
      });
    }

    await this.audit.recordQuietly({
      userId: actorId,
      action: 'booking.updated',
      entityType: 'Booking',
      entityId: id,
      before: { status: before.status },
      after: { status: input.status ?? before.status, notes: input.notes === undefined ? 'unchanged' : 'changed' },
    });
    return this.find(id);
  }

  private async transitionTo(
    id: string,
    input: AdminBookingUpdate,
    before: { status: string; startsAt: Date },
    holds: boolean | undefined,
  ): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(holds === undefined ? {} : { slotStartsAt: holds ? before.startsAt : null }),
          ...(input.notes === undefined ? {} : { notes: input.notes }),
        },
      });
      if (input.status && input.status !== before.status) {
        await tx.bookingEvent.create({
          data: { bookingId: id, type: 'status_changed', detail: { from: before.status, to: input.status } },
        });
      }
    });
  }

  /**
   * The hours calls can be booked in, as one screen reads them.
   *
   * The timezone comes from the page setting rather than from here, because every rule is
   * written in it and the page states it to the visitor: two places to change it is one
   * place to get it wrong.
   */
  async availability(): Promise<AdminAvailability> {
    const [type, overrides, page] = await Promise.all([
      this.prisma.client.consultationType.findFirst({
        where: { active: true },
        orderBy: { name: 'asc' },
        include: { rules: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] } },
      }),
      this.prisma.client.availabilityOverride.findMany({ orderBy: { date: 'asc' } }),
      this.settings.get(BOOKING_SETTING_KEYS.page),
    ]);
    if (!type) throw new NotFoundException();

    return adminAvailabilitySchema.parse({
      consultationType: {
        id: type.id,
        name: type.name,
        slug: type.slug,
        durationMinutes: type.durationMinutes,
        bufferBefore: type.bufferBefore,
        bufferAfter: type.bufferAfter,
        active: type.active,
      },
      timeZone: bookingPageContentSchema.parse(page).timeZone,
      rules: type.rules.map((rule) => ({
        weekday: rule.weekday,
        startMinute: rule.startMinute,
        endMinute: rule.endMinute,
        minimumNoticeHours: rule.minimumNoticeHours,
      })),
      overrides: overrides.map((override) => ({
        id: override.id,
        day: override.date.toISOString().slice(0, 10),
        blocked: override.blocked,
        startMinute: override.startMinute,
        endMinute: override.endMinute,
        reason: override.reason,
      })),
      horizonDays: BOOKING_HORIZON_DAYS,
    });
  }

  /**
   * Replaces the week and the exceptions in one transaction.
   *
   * The rules are written afresh rather than reconciled: a week has at most a couple of
   * dozen rows, and a diff that has to decide which of two identical windows was edited is
   * more ways to be wrong than it is worth. Bookings already made are untouched — a call
   * outside the new hours stays in the calendar, because somebody agreed to it.
   */
  async saveAvailability(input: AdminAvailabilityUpdate, actorId: string): Promise<AdminAvailability> {
    const before = await this.availability();

    await this.prisma.client.$transaction(async (tx) => {
      await tx.consultationType.update({
        where: { id: before.consultationType.id },
        data: {
          durationMinutes: input.durationMinutes,
          bufferBefore: input.bufferBefore,
          bufferAfter: input.bufferAfter,
        },
      });
      await tx.availabilityRule.deleteMany({ where: { consultationTypeId: before.consultationType.id } });
      if (input.rules.length > 0) {
        await tx.availabilityRule.createMany({
          data: input.rules.map((rule) => ({ ...rule, consultationTypeId: before.consultationType.id })),
        });
      }
      await tx.availabilityOverride.deleteMany({});
      if (input.overrides.length > 0) {
        await tx.availabilityOverride.createMany({
          data: input.overrides.map((override) => ({
            date: new Date(`${override.day}T00:00:00.000Z`),
            blocked: override.blocked,
            startMinute: override.startMinute,
            endMinute: override.endMinute,
            reason: override.reason,
          })),
        });
      }
    });

    await this.audit.recordQuietly({
      userId: actorId,
      action: 'booking.availability.updated',
      entityType: 'ConsultationType',
      entityId: before.consultationType.id,
      before: { rules: before.rules.length, overrides: before.overrides.length, duration: before.consultationType.durationMinutes },
      after: { rules: input.rules.length, overrides: input.overrides.length, duration: input.durationMinutes },
    });
    return this.availability();
  }
}
