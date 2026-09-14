import type { Prisma } from '@calwebtech/db';
import {
  INSIGHTS_COPY_SETTING_KEY,
  INSIGHTS_NEWSLETTER_FORM_ID,
  SETTING_KEYS,
  acknowledgementSchema,
  insightsCopySchema,
  type Acknowledgement,
  type BotCheckFailedResponse,
  type EmailJob,
  type LeadReceived,
  type LeadSubmission,
  type LeadSummary,
} from '@calwebtech/shared';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueue } from '../queue/email-queue';
import { SettingsService } from '../settings/settings.service';
import { TurnstileService } from '../turnstile/turnstile.service';

/** For forms without a campaign page. Promises nothing about timing. */
export const DEFAULT_ACKNOWLEDGEMENT: Acknowledgement = {
  heading: 'Thanks. We have your request.',
  body: 'Someone from our team will reply to you by email.',
};

/**
 * The on-screen success copy of the campaign page, or of the homepage (the `home.content`
 * setting) for its forms, so the email repeats what the visitor saw.
 */
function acknowledgementFrom(content: unknown): Acknowledgement {
  const formSuccess =
    typeof content === 'object' && content !== null && 'formSuccess' in content ? content.formSuccess : undefined;
  const parsed = acknowledgementSchema.safeParse(formSuccess);
  return parsed.success ? parsed.data : DEFAULT_ACKNOWLEDGEMENT;
}

/**
 * The success copy of the inline subscribe block on an article (the `insights.copy`
 * setting), so the confirmation email repeats what the subscriber saw on the page.
 */
export function newsletterAcknowledgement(setting: unknown): Acknowledgement {
  const copy = insightsCopySchema.safeParse(setting);
  return copy.success ? copy.data.article.newsletter.success : DEFAULT_ACKNOWLEDGEMENT;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly turnstile: TurnstileService,
    private readonly settings: SettingsService,
    private readonly emailQueue: EmailQueue,
  ) {}

  /**
   * Checks Turnstile, stores the lead against its canonical contact with attribution,
   * then queues the confirmation and the internal notification.
   *
   * Bots that fill the honeypot get the same response as people but nothing is written.
   * A Turnstile rejection writes nothing. Once the lead is stored it is never lost: a
   * queue failure is recorded on the lead instead of failing the request.
   */
  async create(input: LeadSubmission, visitorIp: string | undefined): Promise<LeadReceived> {
    if (input.referenceCode) {
      this.logger.warn(`Honeypot filled on form "${input.formId}"; submission discarded`);
      return { status: 'received' };
    }

    const botCheck = await this.turnstile.verify(input.turnstileToken, visitorIp);
    if (botCheck === 'failed') {
      const body: BotCheckFailedResponse = { error: 'bot_check_failed' };
      throw new ForbiddenException(body);
    }

    const db = this.prisma.client;
    const landingPage = input.landingPageSlug
      ? await db.landingPage.findUnique({
          where: { slug: input.landingPageSlug },
          select: { id: true, content: true },
        })
      : null;
    // The subscribe block on an article is answered with the insights family's copy.
    const insightsCopy =
      !landingPage && input.formId === INSIGHTS_NEWSLETTER_FORM_ID
        ? await db.setting.findUnique({ where: { key: INSIGHTS_COPY_SETTING_KEY }, select: { value: true } })
        : null;
    // Homepage forms have no campaign page; their success copy lives in the homepage setting.
    const homeContent =
      !landingPage && input.formId.startsWith('home-')
        ? await db.setting.findUnique({ where: { key: SETTING_KEYS.homeContent }, select: { value: true } })
        : null;

    const lead = await db.$transaction(async (tx) => {
      const contact = await tx.contact.upsert({
        where: { email: input.email },
        create: {
          email: input.email,
          name: input.name,
          phone: input.phone,
          company: input.company,
        },
        update: {
          name: input.name,
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.company ? { company: input.company } : {}),
        },
      });

      return tx.lead.create({
        data: {
          type: input.type,
          name: input.name,
          email: input.email,
          phone: input.phone,
          company: input.company,
          message: input.message,
          budgetBand: input.budgetBand,
          timeline: input.timeline,
          referralSource: input.referralSource,
          siteUrl: input.siteUrl,
          serviceInterest: input.serviceInterest,
          // The page a resource form was filled on, kept for segmentation (docs/02-content-model.md).
          ...(input.sourcePage ? { answers: { sourcePage: input.sourcePage } } : {}),
          contactId: contact.id,
          attribution: {
            create: {
              firstTouchUtm: input.attribution.firstTouch,
              lastTouchUtm: input.attribution.lastTouch,
              referrer: input.attribution.referrer,
              landingPage: input.attribution.landingPage,
              device: input.attribution.device,
              formId: input.formId,
              landingPageId: landingPage?.id,
            },
          },
          activities: {
            create: [
              { type: 'form_submitted', detail: { formId: input.formId } },
              ...(botCheck === 'unavailable' ? [{ type: 'bot_check_unavailable', detail: { formId: input.formId } }] : []),
            ],
          },
        },
        select: { id: true, createdAt: true },
      });
    });
    if (botCheck === 'unavailable') {
      this.logger.warn(`Lead ${lead.id} stored without a Turnstile verdict`);
    }

    await this.queueEmails(
      input,
      lead,
      insightsCopy
        ? newsletterAcknowledgement(insightsCopy.value)
        : acknowledgementFrom(landingPage?.content ?? homeContent?.value),
    );
    return { status: 'received' };
  }

  private async queueEmails(
    input: LeadSubmission,
    lead: { id: string; createdAt: Date },
    acknowledgement: Acknowledgement,
  ): Promise<void> {
    const summary: LeadSummary = {
      leadId: lead.id,
      type: input.type,
      formId: input.formId,
      name: input.name,
      email: input.email,
      company: input.company,
      phone: input.phone,
      siteUrl: input.siteUrl,
      budgetBand: input.budgetBand,
      timeline: input.timeline,
      serviceInterest: input.serviceInterest,
      message: input.message,
      landingPageSlug: input.landingPageSlug,
      attribution: input.attribution,
      submittedAt: lead.createdAt.toISOString(),
    };
    const jobs: EmailJob[] = [{ template: 'lead-confirmation', to: [input.email], lead: summary, acknowledgement }];

    try {
      const recipients = await this.settings.leadNotificationRecipients();
      if (recipients.length > 0) {
        jobs.push({ template: 'lead-notification', to: recipients, lead: summary });
      } else {
        this.logger.warn(`Lead ${lead.id}: no internal notification, leads.notificationRecipients is empty`);
        await this.recordActivity(lead.id, 'notification_skipped', { reason: 'no notification recipients set' });
      }
      await this.emailQueue.enqueue(jobs);
    } catch (error) {
      this.logger.error(`Lead ${lead.id} is stored, but its emails were not queued: ${String(error)}`);
      await this.recordActivity(lead.id, 'email_queue_failed', {
        templates: jobs.map((job) => job.template),
        error: String(error),
      }).catch((recordError: unknown) => {
        this.logger.error(`Lead ${lead.id}: could not record the queue failure: ${String(recordError)}`);
      });
    }
  }

  private async recordActivity(leadId: string, type: string, detail: Prisma.InputJsonObject): Promise<void> {
    await this.prisma.client.leadActivity.create({ data: { leadId, type, detail } });
  }
}
