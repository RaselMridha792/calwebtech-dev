import {
  FORMS_AUDIT_FAQ_GROUP,
  FORMS_PROJECT_FAQ_GROUP,
  FORMS_SETTING_KEYS,
  type FormsAuditView,
  type FormsProjectDraft,
  type FormsProjectDraftResult,
  type FormsProjectView,
} from '@calwebtech/shared';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { publishedAsOf } from '../common/published';
import { ViewCache } from '../common/view-cache';
import { PrismaService } from '../prisma/prisma.service';
import {
  openProjectDraft,
  projectDraftAnswers,
  projectDraftAttribution,
  projectDraftFields,
} from './forms.draft';
import { toFormsAuditView, toFormsProjectView } from './forms.mapper';

/** How long a built view is reused; changed copy or a newly published service is live within it. */
export const FORMS_PAGE_TTL_MS = 30_000;

/** Questions that belong to the site rather than to a service, industry, location or campaign page. */
const SITE_WIDE_FAQ = { serviceId: null, industryId: null, locationId: null, landingPageId: null };

/** At most this many services are offered as tick boxes, so the step stays readable. */
const SERVICE_LIMIT = 16;

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);
  private readonly projectCache = new ViewCache<FormsProjectView>(FORMS_PAGE_TTL_MS);
  private readonly auditCache = new ViewCache<FormsAuditView>(FORMS_PAGE_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  startProject(): Promise<FormsProjectView> {
    return this.projectCache.get('start-a-project', async () => {
      const db = this.prisma.client;
      const [setting, services, faqs] = await Promise.all([
        this.setting(FORMS_SETTING_KEYS.startProject),
        db.service.findMany({
          where: { deletedAt: null, ...publishedAsOf(new Date()) },
          orderBy: [{ order: 'asc' }, { title: 'asc' }],
          select: { slug: true, title: true },
          take: SERVICE_LIMIT,
        }),
        db.faq.findMany({ where: { ...SITE_WIDE_FAQ, group: FORMS_PROJECT_FAQ_GROUP }, orderBy: { order: 'asc' } }),
      ]);
      return this.validated('start a project page', [FORMS_SETTING_KEYS.startProject], () =>
        toFormsProjectView({ contentSetting: setting, services, faqs }),
      );
    });
  }

  freeWebsiteAudit(): Promise<FormsAuditView> {
    return this.auditCache.get('free-website-audit', async () => {
      const [setting, faqs] = await Promise.all([
        this.setting(FORMS_SETTING_KEYS.freeWebsiteAudit),
        this.prisma.client.faq.findMany({
          where: { ...SITE_WIDE_FAQ, group: FORMS_AUDIT_FAQ_GROUP },
          orderBy: { order: 'asc' },
        }),
      ]);
      return this.validated('free website audit page', [FORMS_SETTING_KEYS.freeWebsiteAudit], () =>
        toFormsAuditView({ contentSetting: setting, faqs }),
      );
    });
  }

  /**
   * Stores the brief at the step the visitor has reached, so a brief nobody finishes is
   * still a lead and each step's drop-off is countable (docs/06-build-plan.md, task 5.2).
   *
   * The first save creates the lead and issues a token; later saves update that same lead,
   * so one brief is one row however often it is saved. The final submit goes to `POST /leads`
   * with the id and token, which completes it there with the usual checks and emails.
   *
   * Bots that fill the honeypot get the same answer as people, with nothing stored and no
   * token, so the page never tells them a draft exists.
   */
  async saveProjectDraft(input: FormsProjectDraft): Promise<FormsProjectDraftResult> {
    if (input.referenceCode) {
      this.logger.warn(`Honeypot filled on form "${input.formId}"; draft discarded`);
      return { status: 'saved', draft: null };
    }

    const db = this.prisma.client;
    const now = new Date();
    const held = input.draftToken;
    const existing =
      input.draftId && held
        ? await db.lead.findFirst({
            where: { id: input.draftId, email: input.email, type: 'PROJECT', deletedAt: null },
            select: { id: true, answers: true },
          })
        : null;
    const open = existing ? openProjectDraft(existing.answers, held) : null;

    if (existing && open && held) {
      const stepChanged = open.draft.step !== input.step;
      await db.lead.update({
        where: { id: existing.id },
        data: {
          ...projectDraftFields(input),
          answers: projectDraftAnswers(input, open, held, now),
          ...(stepChanged
            ? { activities: { create: [{ type: 'draft_saved', detail: { formId: input.formId, step: input.step } }] } }
            : {}),
        },
      });
      return { status: 'saved', draft: { id: existing.id, token: held, step: input.step } };
    }

    const token = randomUUID();
    const lead = await db.$transaction(async (tx) => {
      // The brief resolves to the same person as any other lead; the final submit fills the
      // rest of the contact in, so an existing contact is never overwritten from a draft.
      const contact = await tx.contact.upsert({
        where: { email: input.email },
        create: { email: input.email, name: input.name, phone: input.phone, company: input.company },
        update: {},
      });
      return tx.lead.create({
        data: {
          type: 'PROJECT',
          ...projectDraftFields(input),
          answers: projectDraftAnswers(input, null, token, now),
          contactId: contact.id,
          attribution: { create: projectDraftAttribution(input) },
          activities: { create: [{ type: 'draft_started', detail: { formId: input.formId, step: input.step } }] },
        },
        select: { id: true },
      });
    });
    return { status: 'saved', draft: { id: lead.id, token, step: input.step } };
  }

  private async setting(key: string): Promise<unknown> {
    const row = await this.prisma.client.setting.findUnique({ where: { key }, select: { value: true } });
    return row?.value ?? null;
  }

  /** Runs a mapper; a contract failure is logged with the setting to check and answers 500. */
  private validated<T>(page: string, keys: readonly string[], build: () => T): T {
    try {
      return build();
    } catch (error) {
      this.logger.error(
        `The ${page} failed contract validation. Check the ${keys.map((key) => `"${key}"`).join(' and ')} setting.`,
        error,
      );
      throw new InternalServerErrorException();
    }
  }
}
