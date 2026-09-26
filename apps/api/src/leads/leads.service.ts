import type { Prisma } from '@calwebtech/db';
import {
  DEFAULT_ACKNOWLEDGEMENT,
  EMAIL_DOMAIN_MESSAGES,
  SETTING_KEYS,
  acknowledgementSchema,
  type Acknowledgement,
  type BotCheckFailedResponse,
  type CalculatorLeadReceived,
  type EmailJob,
  type LeadReceived,
  type LeadSubmission,
  type LeadSummary,
  type ValidationErrorResponse,
} from '@calwebtech/shared';
import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { SubmissionGuard } from '../antispam/submission-guard';
import { calculatorLeadOutcome, type CalculatorLeadOutcome } from '../calculator/calculator-lead';
import { publishedAsOf } from '../common/published';
import { completedDraftAnswers, openProjectDraft } from '../forms/forms.draft';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueue } from '../queue/email-queue';
import { SettingsService } from '../settings/settings.service';
import { TurnstileService } from '../turnstile/turnstile.service';

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

/** The enquiry's services with the service page's own title added once, so the team sees the context. */
export function withServiceInterest(serviceInterest: readonly string[], serviceTitle: string): string[] {
  const title = serviceTitle.trim().slice(0, 80);
  const known = serviceInterest.some((item) => item.toLowerCase() === title.toLowerCase());
  return known || title.length === 0 ? [...serviceInterest] : [...serviceInterest, title];
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly turnstile: TurnstileService,
    private readonly settings: SettingsService,
    private readonly emailQueue: EmailQueue,
    private readonly guard: SubmissionGuard,
  ) {}

  /**
   * Checks Turnstile, stores the lead against its canonical contact with attribution,
   * then queues the confirmation and the internal notification.
   *
   * Bots that fill the honeypot get the same response as people but nothing is written.
   * A Turnstile rejection writes nothing. Once the lead is stored it is never lost: a
   * queue failure is recorded on the lead instead of failing the request.
   */
  async create(input: LeadSubmission, visitorIp: string | undefined): Promise<LeadReceived | CalculatorLeadReceived> {
    // The cost calculator's range is recomputed from the answers here and never taken from
    // the browser (calculator/calculator-lead.ts). It is worked out before anything is
    // stored, so a submission with answers the model does not recognise is a 400.
    const db = this.prisma.client;
    const calculator = input.type === 'CALCULATOR' ? await calculatorLeadOutcome(db, input) : null;
    const received = (): LeadReceived | CalculatorLeadReceived =>
      calculator ? { status: 'received', estimate: calculator.estimate } : { status: 'received' };

    if (input.referenceCode) {
      this.logger.warn(`Honeypot filled on form "${input.formId}"; submission discarded`);
      return received();
    }

    // Timing, throwaway inboxes and undeliverable domains, before the bot check is spent
    // (docs/08-decisions.md, 61). Too fast reads as automated, so a person can simply retry.
    await refuseUnlessPlausible(this.guard, 'lead', input.email, input.formElapsedMs);

    const botCheck = await this.turnstile.verify(input.turnstileToken, visitorIp);
    if (botCheck === 'failed') {
      const body: BotCheckFailedResponse = { error: 'bot_check_failed' };
      throw new ForbiddenException(body);
    }
    if (!(await this.guard.withinLimit('lead', input.email))) {
      throw new HttpException({ error: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    // A routed enquiry must name a type that exists, since its mailbox receives the notification.
    const enquiryType = input.enquiryType
      ? await db.enquiryType.findUnique({ where: { slug: input.enquiryType }, select: { slug: true, name: true, mailbox: true } })
      : null;
    if (input.enquiryType && !enquiryType) {
      const body: ValidationErrorResponse = {
        error: 'validation_failed',
        fieldErrors: { enquiryType: ['Choose one of the listed enquiry types'] },
      };
      throw new BadRequestException(body);
    }
    const landingPage = input.landingPageSlug
      ? await db.landingPage.findUnique({
          where: { slug: input.landingPageSlug },
          select: { id: true, content: true },
        })
      : null;
    // A service page enquiry is linked to the service while it is published, and gets its success copy.
    const service =
      !landingPage && input.serviceSlug
        ? await db.service.findFirst({
            where: { slug: input.serviceSlug, deletedAt: null, ...publishedAsOf(new Date()) },
            select: { id: true, title: true, content: true },
          })
        : null;
    // Homepage forms have no campaign page; their success copy lives in the homepage setting.
    const homeContent =
      !landingPage && !service && input.formId.startsWith('home-')
        ? await db.setting.findUnique({ where: { key: SETTING_KEYS.homeContent }, select: { value: true } })
        : null;

    const serviceInterest = service ? withServiceInterest(input.serviceInterest, service.title) : input.serviceInterest;
    // Structured answers without a column of their own, kept queryable beside the lead. The
    // calculator brings its own set, recomputed here, and takes the column when it does.
    const formAnswers: Prisma.InputJsonObject = {
      ...(enquiryType ? { enquiryType: enquiryType.slug } : {}),
      ...(input.projectLinks ? { projectLinks: input.projectLinks } : {}),
      ...(input.mainConcern ? { mainConcern: input.mainConcern } : {}),
      ...(input.competitorUrl ? { competitorUrl: input.competitorUrl } : {}),
    };
    const answers = calculator?.stored ?? (Object.keys(formAnswers).length > 0 ? formAnswers : undefined);
    // An unfinished brief that progressive saving stored (apps/api/src/forms): this submit
    // completes that same lead, so one brief is one row and the drop-off counts stay honest.
    const draftLead = input.draftId
      ? await db.lead.findFirst({
          where: { id: input.draftId, email: input.email, type: input.type, deletedAt: null },
          select: { id: true, answers: true },
        })
      : null;
    const draft = draftLead ? openProjectDraft(draftLead.answers, input.draftToken) : null;
    const now = new Date();
    // The same person sending the same kind of form again while their lead is still open is
    // one conversation, not two leads (docs/08-decisions.md, 61). Only a lead a form was sent
    // for counts, so an unfinished brief is never taken over by it.
    const openLead =
      draftLead && draft
        ? null
        : await db.lead.findFirst({
            where: {
              email: { equals: input.email, mode: 'insensitive' },
              type: input.type,
              deletedAt: null,
              status: { in: [...OPEN_STATUSES] },
              createdAt: { gte: new Date(now.getTime() - MERGE_WINDOW_MS) },
              activities: { some: { type: 'form_submitted' } },
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true, answers: true, serviceInterest: true },
          });
    const attribution = {
      firstTouchUtm: input.attribution.firstTouch,
      lastTouchUtm: input.attribution.lastTouch,
      referrer: input.attribution.referrer,
      landingPage: input.attribution.landingPage,
      device: input.attribution.device,
      formId: input.formId,
      landingPageId: landingPage?.id,
    };
    const activities = [
      {
        type: 'form_submitted',
        detail: { formId: input.formId, ...(enquiryType ? { enquiryType: enquiryType.slug } : {}) },
      },
      ...(botCheck === 'unavailable' ? [{ type: 'bot_check_unavailable', detail: { formId: input.formId } }] : []),
    ];

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

      const fields = {
        type: input.type,
        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company,
        message: input.message,
        // A calculator lead's band is the one its own estimate falls in, so the inbox can
        // be filtered on a figure we calculated rather than one the visitor guessed.
        budgetBand: calculator ? calculator.estimate.budgetBand : input.budgetBand,
        timeline: input.timeline,
        projectType: calculator?.answers.projectType ?? input.projectType,
        referralSource: input.referralSource,
        siteUrl: input.siteUrl,
        serviceInterest,
      };

      if (openLead) {
        // Only what this submission says is written; what it leaves out stays as it was.
        const provided = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
        const updated = await tx.lead.update({
          where: { id: openLead.id },
          data: {
            ...provided,
            serviceInterest: [...new Set([...openLead.serviceInterest, ...serviceInterest])],
            ...(answers ? { answers: mergedAnswers(openLead.answers, answers, calculator !== null) } : {}),
            contactId: contact.id,
            ...(service ? { serviceId: service.id } : {}),
          },
          select: { id: true, createdAt: true },
        });
        const [resubmitted] = await Promise.all([
          tx.leadActivity.create({
            data: {
              leadId: openLead.id,
              type: 'form_resubmitted',
              detail: { formId: input.formId, ...(input.message ? { message: input.message } : {}) },
            },
            select: { id: true },
          }),
          ...activities.map((activity) => tx.leadActivity.create({ data: { leadId: openLead.id, ...activity } })),
        ]);
        return { ...updated, resubmission: resubmitted.id };
      }

      if (draftLead && draft) {
        // The row already exists with this brief's attribution, so it is completed in place.
        return tx.lead.update({
          where: { id: draftLead.id },
          data: {
            ...fields,
            answers: completedDraftAnswers(draft, answers ?? {}, now),
            contactId: contact.id,
            serviceId: service?.id,
            attribution: { upsert: { create: attribution, update: attribution } },
            activities: { create: activities },
          },
          select: { id: true, createdAt: true },
        });
      }

      return tx.lead.create({
        data: {
          ...fields,
          // One `answers` column holds whichever structured answers the form produced.
          answers,
          contactId: contact.id,
          serviceId: service?.id,
          attribution: { create: attribution },
          activities: { create: activities },
        },
        select: { id: true, createdAt: true },
      });
    });
    if (botCheck === 'unavailable') {
      this.logger.warn(`Lead ${lead.id} stored without a Turnstile verdict`);
    }

    await this.queueEmails(
      { ...input, serviceInterest },
      lead,
      acknowledgementFrom(landingPage?.content ?? service?.content ?? homeContent?.value),
      calculator,
      enquiryType,
    );
    return received();
  }

  private async queueEmails(
    input: LeadSubmission,
    lead: { id: string; createdAt: Date; resubmission?: string },
    acknowledgement: Acknowledgement,
    calculator: CalculatorLeadOutcome | null,
    enquiryType: { name: string; mailbox: string } | null,
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
      enquiry: enquiryType?.name,
      landingPageSlug: input.landingPageSlug,
      answers: calculator?.stored,
      attribution: input.attribution,
      submittedAt: lead.createdAt.toISOString(),
    };
    // A calculator lead gets its result instead of the standard confirmation, so the
    // visitor's copy carries the same figures the page showed them.
    // A merged resubmission's emails carry its id, so they are sent rather than taken for a
    // repeat of the first submission's.
    const again = lead.resubmission ? { resubmission: lead.resubmission } : {};
    const jobs: EmailJob[] =
      calculator?.email
        ? [{ template: 'calculator-result', to: [input.email], lead: summary, result: calculator.email, ...again }]
        : [{ template: 'lead-confirmation', to: [input.email], lead: summary, acknowledgement, ...again }];

    try {
      // The enquiry type's own mailbox joins the usual recipients, which is how enquiries are routed.
      const configured = await this.settings.leadNotificationRecipients();
      const mailbox = enquiryType?.mailbox.trim().toLowerCase();
      const recipients = [...new Set([...configured, ...(mailbox && mailbox.includes('@') ? [mailbox] : [])])];
      if (recipients.length > 0) {
        jobs.push({ template: 'lead-notification', to: recipients, lead: summary, ...again });
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

/** A lead still being worked, which a second submission joins rather than starting another. */
const OPEN_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT'] as const;

/** How far back a submission looks for an open lead of the same person and type. */
const MERGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A resubmission's structured answers laid over the lead's. A calculator's answers are one
 * estimate, so the newer replaces the older whole; a form's add to what was there.
 */
export function mergedAnswers(
  existing: Prisma.JsonValue,
  incoming: Prisma.InputJsonValue,
  replace: boolean,
): Prisma.InputJsonValue {
  const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  if (replace || !isObject(existing) || !isObject(incoming)) return incoming;
  return { ...existing, ...incoming };
}

/**
 * Throws what the form shows for an implausible submission: a bot check failure for one sent
 * faster than a person could (so a person can simply try again), and a message under the email
 * field for a throwaway inbox or a domain that cannot receive mail.
 */
export async function refuseUnlessPlausible(
  guard: SubmissionGuard,
  form: 'lead' | 'booking' | 'subscribe',
  email: string,
  elapsedMs: number | undefined,
): Promise<void> {
  const verdict = await guard.precheck(form, email, elapsedMs);
  if (verdict === 'too_fast') {
    const body: BotCheckFailedResponse = { error: 'bot_check_failed' };
    throw new ForbiddenException(body);
  }
  if (verdict === 'disposable' || verdict === 'no_mail') {
    const body: ValidationErrorResponse = {
      error: 'validation_failed',
      fieldErrors: { email: [verdict === 'disposable' ? EMAIL_DOMAIN_MESSAGES.disposable : EMAIL_DOMAIN_MESSAGES.noMail] },
    };
    throw new BadRequestException(body);
  }
}
