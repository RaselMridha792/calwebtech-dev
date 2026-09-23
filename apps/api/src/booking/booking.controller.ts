import type { BookingConfirmation, BookingPageView, BookingSlotsView, BookingSubmission } from '@calwebtech/shared';
import { bookingSubmissionSchema } from '@calwebtech/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Module, Post, Query } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
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
}

@Module({
  controllers: [BookingPageController, BookingController],
  providers: [
    BookingService,
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
