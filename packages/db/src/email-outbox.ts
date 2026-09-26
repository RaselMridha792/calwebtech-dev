import type { EmailJob } from '@calwebtech/shared';
import type { Prisma } from './generated/prisma/client';

/**
 * The email outbox (docs/08-decisions.md, 71). Here rather than in the API because the API
 * writes the rows inside a lead's or a booking's transaction and the worker's sweep reads
 * them back, and the two must agree on what a row is and which rows are still to send.
 */

/**
 * The emails the outbox holds: everything a lead or a booking sends. A campaign's test send
 * is the team's own request from the dashboard and goes to the queue directly.
 */
export type OutboxEmailJob = Exclude<EmailJob, { template: 'campaign-test' }>;

/** One email as an outbox row: the job whole, whose it is, and when it is due. */
export function emailOutboxData(job: OutboxEmailJob, sendAt: Date): Prisma.EmailOutboxCreateManyInput {
  return {
    template: job.template,
    payload: job,
    leadId: 'lead' in job ? job.lead.leadId : null,
    bookingId: 'bookingId' in job ? job.bookingId : null,
    sendAt,
  };
}

/** A row still to send: not sent, not withdrawn and not given up on. The sweep queues these. */
export const PENDING_EMAIL_OUTBOX = {
  sentAt: null,
  cancelledAt: null,
  failedAt: null,
} satisfies Prisma.EmailOutboxWhereInput;
