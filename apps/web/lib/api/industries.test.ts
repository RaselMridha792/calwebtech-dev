import { industriesIndexViewSchema, industryDetailViewSchema } from '@calwebtech/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { industriesIndexSnapshot, industrySnapshots } from '@/static-content/industries';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** A fresh module each time, so React's `cache` keeps nothing from the test before. */
async function load(env: { api?: string; source?: string; first?: string } = {}) {
  vi.stubEnv('API_INTERNAL_URL', env.api ?? '');
  vi.stubEnv('CONTENT_SOURCE', env.source ?? '');
  vi.stubEnv('CONTENT_DATABASE_FIRST', env.first ?? '');
  return import('./industries');
}

function respond(routes: Record<string, { status: number; body: unknown }>) {
  const fetchMock = vi.fn((url: string) => {
    const route = Object.entries(routes).find(([path]) => url.endsWith(path));
    return Promise.resolve(Response.json(route?.[1].body ?? {}, { status: route?.[1].status ?? 404 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const snapshot = industriesIndexViewSchema.parse(industriesIndexSnapshot);
const [first, second] = snapshot.industries;
if (!first || !second) throw new Error('the industries snapshot needs two industries');
const LAUNCH = { api: 'http://api.internal:4000', source: 'snapshot', first: 'services,industries' };

describe('the industries getters in the launch mode, database first', () => {
  it('list the database\'s industries first and the snapshot\'s it does not have after them', async () => {
    const created = { slug: 'test-new-sector', name: 'Test new sector', line: null, image: null };
    const renamed = { ...second, name: 'Test renamed in the admin' };
    respond({ '/pages/industries': { status: 200, body: { content: snapshot.content, industries: [created, renamed] } } });
    const { getIndustriesIndex } = await load(LAUNCH);

    const slugs = (await getIndustriesIndex()).industries.map((industry) => industry.slug);
    expect(slugs.slice(0, 2)).toEqual([created.slug, second.slug]);
    expect(slugs).toHaveLength(snapshot.industries.length + 1);
    expect(new Set(slugs).size).toBe(slugs.length);
    const index = await getIndustriesIndex();
    expect(index.industries.find((industry) => industry.slug === second.slug)?.name).toBe('Test renamed in the admin');
  });

  it('render an industry from the database, and fall back to the snapshot when it has none', async () => {
    const approved = industryDetailViewSchema.parse(industrySnapshots[first.slug]);
    respond({ [`/pages/industries/${second.slug}`]: { status: 200, body: { ...approved, slug: second.slug, title: 'Test title from the database' } } });
    const { getIndustryPage } = await load(LAUNCH);

    expect((await getIndustryPage(second.slug))?.title).toBe('Test title from the database');
    expect(await getIndustryPage(first.slug)).toEqual(approved);
    expect(await getIndustryPage('no-such-sector')).toBeNull();
  });

  it('keep reading only the snapshot while the family is not named', async () => {
    const fetchMock = respond({});
    const { getIndustriesIndex, getIndustryPage } = await load({ ...LAUNCH, first: 'services' });
    expect(await getIndustriesIndex()).toEqual(snapshot);
    expect(await getIndustryPage(first.slug)).toEqual(industryDetailViewSchema.parse(industrySnapshots[first.slug]));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
