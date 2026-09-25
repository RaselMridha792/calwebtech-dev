import type {
  BookingCancel,
  BookingConfirmation,
  BookingManageView,
  BookingPageView,
  BookingReschedule,
  BookingSlotsView,
  BookingSubmission,
} from '@calwebtech/shared';
import {
  BOOKING_ERRORS,
  bookingCancelSchema,
  bookingRescheduleSchema,
  bookingSubmissionSchema,
  bookingTokenSchema,
} from '@calwebtech/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { submissionGuardProvider } from '../antispam/antispam.provider';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { API_ENV, type ApiEnv } from '../config/env';
import { EmailQueue } from '../queue/email-queue';
import { SettingsService } from '../settings/settings.service';
import { TurnstileService } from '../turnstile/turnstile.service';
import { BookingService } from './booking.service';

/** `/book-a-consultation/`: the page's copy and the slots it can offer right now. */
@Controller('pages/book-a-consultation')
export class BookingPageController {
  constructor(private readonly booking: BookingService) {}

  @Get()
  @SkipThrottle()
  find(): Promise<BookingPageView> {
    return this.booking.page();
  }
}

@Controller('booking')
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  /**
   * The slots as they stand, rebuilt on every call. Nothing here is cached: a cached slot
   * is one somebody else has already taken, offered to the next visitor as if it were free.
   */
  @Get('slots')
  @SkipThrottle()
  slots(@Query('type') type?: string): Promise<BookingSlotsView> {
    return this.booking.slots(type);
  }

  /**
   * Five bookings a minute per visitor IP — harder than a lead form, because a booking
   * takes a slot away from everyone else and a loop could empty the calendar.
   *
   * 201 with the confirmation, 400 with field errors, 403 `bot_check_failed`, and 409
   * when the slot went between the page loading and this call.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(
    @Body(new ZodValidationPipe(bookingSubmissionSchema)) body: BookingSubmission,
    @Ip() visitorIp: string,
  ): Promise<BookingConfirmation> {
    return this.booking.create(body, visitorIp);
  }

  /**
   * The call a signed link names, and whether the link moves or cancels it
   * (docs/08-decisions.md, 60). 404 for a token that is malformed or names nothing, so the
   * two cannot be told apart.
   */
  @Get('manage/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  manage(@Param('token') token: string): Promise<BookingManageView> {
    const parsed = bookingTokenSchema.safeParse(token);
    if (!parsed.success) throw new NotFoundException({ error: BOOKING_ERRORS.linkUnknown });
    return this.booking.manage(parsed.data);
  }

  /** 200 with the cancelled call; 409 `booking_closed` for one already held or closed. */
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  cancel(@Body(new ZodValidationPipe(bookingCancelSchema)) body: BookingCancel): Promise<BookingManageView> {
    return this.booking.cancel(body.token);
  }

  /**
   * 200 with the call at its new time; 409 when the time is not offered or went meanwhile,
   * as for a new booking, or when the call can no longer move.
   */
  @Post('reschedule')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  reschedule(@Body(new ZodValidationPipe(bookingRescheduleSchema)) body: BookingReschedule): Promise<BookingManageView> {
    return this.booking.reschedule(body);
  }
}

@Module({
  controllers: [BookingPageController, BookingController],
  providers: [
    BookingService,
    submissionGuardProvider,
    SettingsService,
    {
      provide: TurnstileService,
      useFactory: (env: ApiEnv) => new TurnstileService(env.TURNSTILE_SECRET ?? ''),
      inject: [API_ENV],
    },
    {
      provide: EmailQueue,
      useFactory: (env: ApiEnv) => new EmailQueue(env.REDIS_URL),
      inject: [API_ENV],
    },
  ],
})
export class BookingModule {}
