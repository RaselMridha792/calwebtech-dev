import { staticNotFoundViewSchema } from '@calwebtech/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { staticNotFoundSnapshot } from '@/static-content/static';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** A fresh module each time, so React's `cache` keeps nothing from the test before. */
async function load() {
  return import('./static');
}

describe('the 404 for unmatched URLs', () => {
  it('is regenerated at runtime on the same interval its copy is cached for', async () => {
    const { STATIC_NOT_FOUND_REVALIDATE_SECONDS } = await load();
    const page = await import('@/app/not-found');
    expect(page.revalidate).toBe(STATIC_NOT_FOUND_REVALIDATE_SECONDS);
  });

  it('never bakes the demo telephone and email into a build made without the API', async () => {
    vi.stubEnv('API_INTERNAL_URL', '');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    const { getStaticNotFound } = await load();
    const view = await getStaticNotFound();
    const snapshot = staticNotFoundViewSchema.parse(staticNotFoundSnapshot);
    expect(view).toEqual({ ...snapshot, contact: null });
  });

  it('shows the full snapshot at runtime without the API (the Vercel demo)', async () => {
    vi.stubEnv('API_INTERNAL_URL', '');
    vi.stubEnv('NEXT_PHASE', '');
    const { getStaticNotFound } = await load();
    expect(await getStaticNotFound()).toEqual(staticNotFoundViewSchema.parse(staticNotFoundSnapshot));
  });

  it('reads the stored copy with a revalidate interval, and falls back to the plain page when it cannot', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000');
    const live = { ...staticNotFoundViewSchema.parse(staticNotFoundSnapshot), title: 'Stored title' };
    const fetchMock = vi.fn(() => Promise.resolve(Response.json(live)));
    vi.stubGlobal('fetch', fetchMock);
    const first = await load();
    expect(await first.getStaticNotFound()).toEqual(live);
    expect(fetchMock).toHaveBeenCalledWith('http://api.internal:4000/pages/not-found', {
      next: { revalidate: first.STATIC_NOT_FOUND_REVALIDATE_SECONDS },
    });

    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json({ message: 'Internal' }, { status: 500 }))));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const second = await load();
    expect(await second.getStaticNotFound()).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
