import {
  BOOKING_SETTING_KEYS,
  DEFAULT_BOOKING_PAGE,
  DEFAULT_CONSULTATION,
  bookingPageContentSchema,
} from '@calwebtech/shared';
import type { SnapshotImporter } from './index';

/**
 * What the booking page needs to exist at all: its copy, the business timezone every
 * availability rule is written in, one consultation type and the hours it can be booked
 * (task 5.1).
 *
 * Its own family rather than a few lines inside `operational`, because it was added after
 * production launched. The marker names the families that have run, so a family of its own
 * runs on the next deploy while the ones somebody has since edited are left alone; folded
 * into `operational` it would have been skipped forever, which is how the live site came to
 * answer 500 on a page with no consultation type.
 *
 * All of it `once`. The copy is a working default, not the owner's words, and the timezone
 * is the first office's — both are a setting and a row, changeable from the dashboard
 * without a deploy, and neither is overwritten again once it exists.
 */
export const bookingImporter: SnapshotImporter = {
  family: 'booking',
  async run(ctx) {
    await ctx.setSettingOnce(BOOKING_SETTING_KEYS.page, bookingPageContentSchema.parse(DEFAULT_BOOKING_PAGE));

    const existing = await ctx.db.consultationType.findUnique({ where: { slug: DEFAULT_CONSULTATION.slug } });
    if (existing) return;
    const type = await ctx.db.consultationType.create({
      data: {
        slug: DEFAULT_CONSULTATION.slug,
        name: DEFAULT_CONSULTATION.name,
        durationMinutes: DEFAULT_CONSULTATION.durationMinutes,
        bufferAfter: DEFAULT_CONSULTATION.bufferAfter,
        description: DEFAULT_CONSULTATION.description,
      },
    });
    await ctx.db.availabilityRule.createMany({
      data: DEFAULT_CONSULTATION.weekdays.map((weekday) => ({
        consultationTypeId: type.id,
        weekday,
        startMinute: DEFAULT_CONSULTATION.startMinute,
        endMinute: DEFAULT_CONSULTATION.endMinute,
        minimumNoticeHours: DEFAULT_CONSULTATION.minimumNoticeHours,
      })),
    });
    ctx.log('import: booking: a consultation type and its weekday hours');
  },
};
