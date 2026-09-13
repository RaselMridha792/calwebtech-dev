import type { LeadReceived, LeadSubmission } from '@calwebtech/shared';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stores a lead against its canonical contact, with attribution and a first
   * activity entry. Bots that fill the honeypot get the same response as people
   * but nothing is written.
   */
  async create(input: LeadSubmission): Promise<LeadReceived> {
    if (input.referenceCode) {
      this.logger.warn(`Honeypot filled on form "${input.formId}"; submission discarded`);
      return { status: 'received' };
    }

    const db = this.prisma.client;
    const landingPage = input.landingPageSlug
      ? await db.landingPage.findUnique({
          where: { slug: input.landingPageSlug },
          select: { id: true },
        })
      : null;

    await db.$transaction(async (tx) => {
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

      await tx.lead.create({
        data: {
          type: input.type,
          name: input.name,
          email: input.email,
          phone: input.phone,
          company: input.company,
          message: input.message,
          budgetBand: input.budgetBand,
          timeline: input.timeline,
          siteUrl: input.siteUrl,
          serviceInterest: input.serviceInterest,
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
            create: { type: 'form_submitted', detail: { formId: input.formId } },
          },
        },
      });
    });

    return { status: 'received' };
  }
}
