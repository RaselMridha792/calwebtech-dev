import { existsSync } from 'node:fs';
import path from 'node:path';
import { emailJobId, type EmailJob } from '@calwebtech/shared';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { createEmailJobProcessor, type DeliveryStore } from './process-email-job';
import type { EmailTransport, OutgoingEmail } from './transport';

// Needs Redis: infra/docker-compose.yml with the dev overrides locally, a service in CI.
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) throw new Error('REDIS_URL is required for the worker integration tests');

const queueName = `email-integration-${String(process.pid)}-${String(Date.now())}`;
const connections: Redis[] = [];
const connect = (options: { worker?: boolean } = {}) => {
  const connection = new Redis(REDIS_URL, options.worker ? { maxRetriesPerRequest: null } : {});
  connections.push(connection);
  return connection;
};

const job: EmailJob = {
  template: 'lead-confirmation',
  to: ['delivered@resend.dev'],
  lead: {
    leadId: `integration${String(Date.now())}`,
    type: 'PROJECT',
    formId: 'lp-hero',
    name: 'Dana Whitfield',
    email: 'delivered@resend.dev',
    serviceInterest: [],
    attribution: {},
    submittedAt: new Date().toISOString(),
  },
  acknowledgement: { heading: 'Thanks. We have it.', body: 'A person will reply.' },
};

afterAll(async () => {
  const cleanup = new Queue(queueName, { connection: connect() });
  await cleanup.obliterate({ force: true });
  await cleanup.close();
  await Promise.all(connections.map((connection) => connection.quit()));
});

describe('email queue against Redis', () => {
  it('delivers a job through the worker exactly once, even when it is added twice', async () => {
    const sent: OutgoingEmail[] = [];
    const transport: EmailTransport = {
      name: 'fake',
      send(email) {
        sent.push(email);
        return Promise.resolve({ id: 'provider-1' });
      },
    };
    const store: DeliveryStore = {
      siteContact: () => Promise.resolve(null),
      recordDelivery: () => Promise.resolve(),
      recordBookingDelivery: () => Promise.resolve(),
      bookingState: () => Promise.resolve(null),
    };

    const queue = new Queue(queueName, { connection: connect() });
    await queue.add(job.template, job, { jobId: emailJobId(job) });
    await queue.add(job.template, job, { jobId: emailJobId(job) });

    const worker = new Worker(queueName, createEmailJobProcessor({ transport, store, from: 'Calwebtech <onboarding@resend.dev>' }), {
      connection: connect({ worker: true }),
    });
    const deadline = Date.now() + 15_000;
    while (((await queue.getJobCounts('completed')).completed ?? 0) < 1 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await worker.close();
    await queue.close();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: ['delivered@resend.dev'], idempotencyKey: emailJobId(job) });
  });
});
