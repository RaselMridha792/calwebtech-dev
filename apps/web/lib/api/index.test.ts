import type { LeadSubmission } from '@calwebtech/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLandingPage, postLead } from './index';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const submission: LeadSubmission = {
  type: 'PROJECT',
  formId: 'lp-hero',
  name: 'Test Person',
  email: 'person@example.com',
  serviceInterest: [],
  attribution: {},
};

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn(() => Promise.resolve(Response.json(body, { status })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('with the API and CONTENT_SOURCE=snapshot (the launch mode, decision 43)', () => {
  it('renders the landing page from its snapshot without asking the API', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000');
    vi.stubEnv('CONTENT_SOURCE', 'snapshot');
    const fetchMock = respond(200, {});
    expect((await getLandingPage('b2b-website-design'))?.slug).toBe('b2b-website-design');
    expect(await getLandingPage('no-such-campaign')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still posts the lead to the API, so it is stored', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000');
    vi.stubEnv('CONTENT_SOURCE', 'snapshot');
    const fetchMock = respond(202, { status: 'received' });
    expect(await postLead(submission, '203.0.113.7')).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.internal:4000/leads');
    expect(init.method).toBe('POST');
  });
});

describe('without the API (the Vercel demo)', () => {
  it('cannot send, whatever the content source says', async () => {
    vi.stubEnv('API_INTERNAL_URL', '');
    vi.stubEnv('CONTENT_SOURCE', 'snapshot');
    const fetchMock = respond(202, {});
    expect(await postLead(submission, null)).toEqual({ ok: false, reason: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
