import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { findView, getView } from './core';

vi.mock('server-only', () => ({}));

const schema = z.object({ title: z.string().min(1) });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn(() => Promise.resolve(Response.json(body, { status })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('without the API (the Vercel demo)', () => {
  it('validates and returns the snapshot, and treats a missing snapshot as no record', async () => {
    vi.stubEnv('API_INTERNAL_URL', '');
    expect(await getView('/pages/test', schema, { title: 'Snapshot' })).toEqual({ title: 'Snapshot' });
    expect(await findView('/pages/test/missing', schema, undefined)).toBeNull();
    await expect(getView('/pages/test', schema, { title: '' })).rejects.toThrow();
  });
});

describe('with the API', () => {
  it('fetches the path uncached and validates the response', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000/');
    const fetchMock = respond(200, { title: 'Live' });
    expect(await getView('/pages/test', schema, { title: 'Snapshot' })).toEqual({ title: 'Live' });
    expect(fetchMock).toHaveBeenCalledWith('http://api.internal:4000/pages/test', { cache: 'no-store' });
  });

  it('returns null for a record the API does not publish, and throws on anything else', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000');
    respond(404, { message: 'Not Found' });
    expect(await findView('/pages/test/missing', schema, null)).toBeNull();
    respond(400, { message: 'Bad slug' });
    expect(await findView('/pages/test/Bad', schema, null)).toBeNull();
    respond(500, { message: 'Internal' });
    await expect(findView('/pages/test/broken', schema, null)).rejects.toThrow('API responded 500');
    await expect(getView('/pages/test', schema, null)).rejects.toThrow('API responded 500');
  });
});

describe('with the API and CONTENT_SOURCE=snapshot (the launch mode, decision 43)', () => {
  it('renders the snapshot and never asks the API for content', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000');
    vi.stubEnv('CONTENT_SOURCE', 'snapshot');
    const fetchMock = respond(200, { title: 'Live' });
    expect(await getView('/pages/test', schema, { title: 'Snapshot' })).toEqual({ title: 'Snapshot' });
    expect(await findView('/pages/test/one', schema, { title: 'Snapshot' })).toEqual({ title: 'Snapshot' });
    expect(await findView('/pages/test/missing', schema, undefined)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the API for any other value, and when it is unset', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000');
    for (const source of ['api', '']) {
      vi.stubEnv('CONTENT_SOURCE', source);
      respond(200, { title: 'Live' });
      expect(await getView('/pages/test', schema, { title: 'Snapshot' })).toEqual({ title: 'Live' });
    }
  });
});
