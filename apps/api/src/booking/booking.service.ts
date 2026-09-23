import { randomBytes } from 'node:crypto';
import { Prisma } from '@calwebtech/db';
import {
  BOOKING_ERRORS,
  BOOKING_FORM_ID,
  BOOKING_HORIZON_DAYS,
  BOOKING_SETTING_KEYS,
  type AvailabilityOverride,
  type AvailabilityRule,
  type BookingConfirmation,
  type BookingPageView,
  type BookingSlotsView,
  type BookingSubmission,
  addDays,
  bookingPageContentSchema,
  bookingSlotsViewSchema,
  dayKeyOf,
  generateSlots,
} from '@calwebtech/shared';
import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EmailQueue } from '../queue/email-queue';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { TurnstileService } from '../turnstile/turnstile.service';

/**
 * The booking engine (docs/06-build-plan.md, task 5.1).
 *
 * The browser is shown a list of slots and posts one back. This service rebuilds that list
 * from the rules and refuses anything not in it, because a slot the page offered five
 * minutes ago may not exist now and a slot it never offered may have been typed in.
 *
 * The last word belongs to the database. `Booking` is unique on
 * `(consultationTypeId, startsAt)`, so when two people confirm the same slot in the same
 * second one insert succeeds and the other raises P2002 — which this service reports as
 * "that time has gone" rather than as a failure. Checking first and inserting second would
 * leave exactly the window the constraint closes.
 */
@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly turnstile: TurnstileService,
    private readonly settings: SettingsService,
    private readonly emailQueue: EmailQueue,
  ) {}

  /** The page's copy and its business timezone. */
  private async content() {
    const row = await this.settings.get(BOOKING_SETTING_KEYS.page);
    return bookingPageContentSchema.parse(row);
  }

  /** The type a booking is for, with the rules that decide when it can happen. */
  private async consultationType(slug?: string) {
    const type = await this.prisma.client.consultationType.findFirst({
      where: slug ? { slug, active: true } : { active: true },
      orderBy: { name: 'asc' },
      include: { rules: true },
    });
    if (!type) throw new NotFoundException(BOOKING_ERRORS.typeUnknown);
    return type;
  }

  /**
   * Every bookable slot inside the horizon, in the business timezone.
   *
   * Overrides are read for the whole window rather than per day, and bookings only for
   * the window, so a year of history never enters the calculation.
   */
  async slots(typeSlug?: string): Promise<BookingSlotsView> {
    const content = await this.content();
    const type = await this.consultationType(typeSlug);
    const now = new Date();
    const from = dayKeyOf(now, content.timeZone);
    const to = addDays(from, BOOKING_HORIZON_DAYS);

    const [overrides, taken] = await Promise.all([
      this.prisma.client.availabilityOverride.findMany({
        where: { date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) } },
      }),
      this.prisma.client.booking.findMany({
        where: {
          consultationTypeId: type.id,
          status: { notIn: ['CANCELLED'] },
          startsAt: { gte: now },
        },
        select: { startsAt: true },
      }),
    ]);

    const rules: AvailabilityRule[] = type.rules.map((rule) => ({
      weekday: rule.weekday,
      startMinute: rule.startMinute,
      endMinute: rule.endMinute,
      minimumNoticeHours: rule.minimumNoticeHours,
    }));
    const dayOverrides: AvailabilityOverride[] = overrides.map((override) => ({
      day: override.date.toISOString().slice(0, 10),
      blocked: override.blocked,
      startMinute: override.startMinute,
      endMinute: override.endMinute,
      reason: override.reason,
    }));

    const days = generateSlots({
      timeZone: content.timeZone,
      durationMinutes: type.durationMinutes,
      bufferBefore: type.bufferBefore,
      bufferAfter: type.bufferAfter,
      rules,
      overrides: dayOverrides,
      taken: taken.map((booking) => booking.startsAt),
      from,
      to,
      now,
    });

    return bookingSlotsViewSchema.parse({
      consultationType: {
        slug: type.slug,
        name: type.name,
        durationMinutes: type.durationMinutes,
        description: type.description,
      },
      timeZone: content.timeZone,
      days: days
        .filter((day) => day.slots.length > 0)
        .map((day) => ({
          day: day.day,
          slots: day.slots.map((slot) => ({
            startsAt: slot.startsAt.toISOString(),
            endsAt: slot.endsAt.toISOString(),
          })),
        })),
    });
  }

  /** The page: its copy and the slots it can offer right now. */
  async page(): Promise<BookingPageView> {
    const [content, slots] = await Promise.all([this.content(), this.slots()]);
    return { content, slots };
  }

  /**
   * Stores a booking, or says why not.
   *
   * The order matters: the bot check first, then the slot rebuilt and checked, then the
   * insert that the database arbitrates. The contact is upserted in the same transaction
   * as the booking, so a refused slot leaves no half-written person behind.
   */
  async create(input: BookingSubmission, visitorIp: string | undefined): Promise<BookingConfirmation> {
    const botCheck = await this.turnstile.verify(input.turnstileToken, visitorIp);
    if (botCheck === 'failed') throw new ForbiddenException({ error: 'bot_check_failed' });

    const type = await this.consultationType(input.consultationType);
    const startsAt = new Date(input.startsAt);
    const offered = await this.slots(type.slug);
    const isOffered = offered.days.some((day) => day.slots.some((slot) => slot.startsAt === startsAt.toISOString()));
    if (!isOffered) throw new ConflictException({ error: BOOKING_ERRORS.slotUnknown });

    const endsAt = new Date(startsAt.getTime() + type.durationMinutes * 60_000);
    const rescheduleToken = randomBytes(24).toString('base64url');
    const cancelToken = randomBytes(24).toString('base64url');
    const email = input.email.trim().toLowerCase();

    try {
      const booking = await this.prisma.client.$transaction(async (tx) => {
        const contact = await tx.contact.upsert({
          where: { email },
          create: { email, name: input.name, phone: input.phone ?? null },
          update: { name: input.name, ...(input.phone ? { phone: input.phone } : {}) },
        });
        const created = await tx.booking.create({
          data: {
            consultationTypeId: type.id,
            contactId: contact.id,
            name: input.name,
            email,
            phone: input.phone ?? null,
            timezone: input.timezone,
            startsAt,
            endsAt,
            context: input.context ?? null,
            rescheduleToken,
            cancelToken,
          },
        });
        await tx.bookingEvent.create({
          data: { bookingId: created.id, type: 'created', detail: { source: input.source ?? BOOKING_FORM_ID } },
        });
        return created;
      });

      await this.notify(booking.id, input, type.name, startsAt, endsAt);
      return {
        status: 'booked',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        consultationType: type.name,
        rescheduleToken,
        cancelToken,
      };
    } catch (error) {
      // P2002 is the unique constraint on (consultationTypeId, startsAt): somebody else
      // confirmed this slot between the page loading and this insert.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ error: BOOKING_ERRORS.slotGone });
      }
      throw error;
    }
  }

  /**
   * Queues the confirmation and the notification.
   *
   * A failure here never fails the booking: the call is in the database and the team can
   * see it, which is more than an email would have told them.
   */
  private async notify(
    bookingId: string,
    input: BookingSubmission,
    typeName: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    try {
      const recipients = await this.settings.leadNotificationRecipients();
      await this.emailQueue.enqueue([
        {
          template: 'booking-confirmation',
          to: [input.email],
          bookingId,
          name: input.name,
          consultationType: typeName,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          timezone: input.timezone,
        },
        ...(recipients.length > 0
          ? [
              {
                template: 'booking-notification' as const,
                to: recipients,
                bookingId,
                name: input.name,
                email: input.email,
                consultationType: typeName,
                startsAt: startsAt.toISOString(),
                timezone: input.timezone,
                context: input.context ?? null,
              },
            ]
          : []),
      ]);
    } catch (error) {
      this.logger.error(`Booking ${bookingId} was stored but its emails could not be queued.`, error);
    }
  }
}
