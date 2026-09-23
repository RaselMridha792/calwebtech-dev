import type { Prisma } from '@calwebtech/db';
import {
  type AdminBooking,
  type AdminBookingDetail,
  type AdminBookingList,
  type AdminBookingQuery,
  type AdminBookingUpdate,
  adminBookingDetailSchema,
  adminBookingListSchema,
} from '@calwebtech/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../auth/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
    const before = await this.prisma.client.booking.findUnique({ where: { id }, select: { status: true } });
    if (!before) throw new NotFoundException();

    await this.prisma.client.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.notes === undefined ? {} : { notes: input.notes }),
        },
      });
      if (input.status && input.status !== before.status) {
        await tx.bookingEvent.create({
          data: { bookingId: id, type: 'status_changed', detail: { from: before.status, to: input.status } },
        });
      }
    });

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
}
