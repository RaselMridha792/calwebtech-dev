import { verifyUnsubscribeToken } from '@calwebtech/shared/unsubscribe-token';
import { UnrecoverableError } from 'bullmq';
import { describe, expect, it } from 'vitest';
import { createCampaignSendProcessor, type CampaignSendStore, type RecipientToSend } from './campaign-send';
import type { EmailTransport, OutgoingEmail } from './transport';

const SECRET = 'a-long-enough-test-secret-value';
const ORIGIN = 'https://calwebtech.com';

function recipient(overrides: Partial<RecipientToSend> = {}): RecipientToSend {
  return {
    id: 'rcp1',
    email: 'ava@example.com',
    subscriberId: 'sub1',
    sentAt: null,
    failedAt: null,
    name: 'Ava Stone',
    unsubscribedAt: null,
    suppressed: false,
    content: {
      subject: 'News for {{firstName|you}}',
      templateKey: 'letter',
      body: { blocks: [{ type: 'paragraph', text: 'Hi {{firstName|there}}.' }] },
    },
    ...overrides,
  };
}

function fakes(row: RecipientToSend | null) {
  const sent: OutgoingEmail[] = [];
  const marks: { id: string; kind: 'sent' | 'not-sent'; value: string }[] = [];
  const transport: EmailTransport = {
    name: 'fake',
    send(email) {
      sent.push(email);
      return Promise.resolve({ id: 'provider-1' });
    },
  };
  const store: CampaignSendStore = {
    recipient: () => Promise.resolve(row),
    markSent: (id, providerId) => {
      marks.push({ id, kind: 'sent', value: providerId });
      return Promise.resolve();
    },
    markNotSent: (id, reason) => {
      marks.push({ id, kind: 'not-sent', value: reason });
      return Promise.resolve();
    },
  };
  const process = createCampaignSendProcessor({ transport, store, from: 'Calwebtech <hi@x.com>', siteOrigin: ORIGIN, secret: SECRET });
  return { sent, marks, process };
}

describe('campaign send', () => {
  it('sends one personalised email with a working unsubscribe link and the one-click headers', async () => {
    const { sent, marks, process } = fakes(recipient());
    await expect(process({ data: { recipientId: 'rcp1' } })).resolves.toEqual({ status: 'sent', providerId: 'provider-1' });

    const email = sent[0];
    expect(email?.subject).toBe('News for Ava');
    expect(email?.to).toEqual(['ava@example.com']);
    expect(email?.idempotencyKey).toBe('campaign-send-rcp1');
    expect(email?.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');

    const oneClick = /<https:\/\/calwebtech\.com\/api\/unsubscribe\/([^>]+)>/.exec(email?.headers?.['List-Unsubscribe'] ?? '');
    expect(verifyUnsubscribeToken(oneClick?.[1] ?? '', SECRET)).toBe('sub1');
    expect(email?.html).toContain(`${ORIGIN}/unsubscribe/`);
    expect(marks).toEqual([{ id: 'rcp1', kind: 'sent', value: 'provider-1' }]);
  });

  it('does not send to an address suppressed since the audience was counted', async () => {
    const { sent, marks, process } = fakes(recipient({ suppressed: true }));
    await expect(process({ data: { recipientId: 'rcp1' } })).resolves.toEqual({ status: 'skipped' });
    expect(sent).toEqual([]);
    expect(marks).toEqual([{ id: 'rcp1', kind: 'not-sent', value: 'suppressed' }]);
  });

  it('does not send to somebody who unsubscribed in the meantime', async () => {
    const { sent, marks, process } = fakes(recipient({ unsubscribedAt: new Date() }));
    await process({ data: { recipientId: 'rcp1' } });
    expect(sent).toEqual([]);
    expect(marks[0]?.value).toBe('unsubscribed');
  });

  it('never sends twice to a recipient already sent to', async () => {
    const { sent, marks, process } = fakes(recipient({ sentAt: new Date() }));
    await expect(process({ data: { recipientId: 'rcp1' } })).resolves.toEqual({ status: 'already' });
    expect(sent).toEqual([]);
    expect(marks).toEqual([]);
  });

  it('does not retry a job for a recipient that no longer exists, or a bad payload', async () => {
    await expect(fakes(null).process({ data: { recipientId: 'gone' } })).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(fakes(recipient()).process({ data: {} })).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
