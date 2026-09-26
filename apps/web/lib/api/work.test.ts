import {
  homePageViewSchema,
  homepageComparison,
  workBeforeAndAfterViewSchema,
  workCaseStudyViewSchema,
  workIndexViewSchema,
  type WorkBeforeAndAfterView,
  type WorkComparison,
  type WorkIndexView,
} from '@calwebtech/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import staticHome from '@/static-content/home.json';
import { workBeforeAndAfterSnapshot, workCaseStudySnapshots, workIndexSnapshot } from '@/static-content/work';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** A fresh module each time, so React's `cache` keeps nothing from the test before. */
async function load(first: string) {
  vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000');
  vi.stubEnv('CONTENT_SOURCE', 'snapshot');
  vi.stubEnv('CONTENT_DATABASE_FIRST', first);
  return import('./work');
}

function respond(routes: Record<string, unknown>) {
  const fetchMock = vi.fn((url: string) => {
    const hit = Object.entries(routes).find(([path]) => url.endsWith(path));
    return Promise.resolve(Response.json(hit?.[1] ?? {}, { status: hit ? 200 : 404 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const snapshot = workIndexViewSchema.parse(workIndexSnapshot);

function need<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('the work snapshot needs two case studies');
  return value;
}
const first = need(snapshot.caseStudies[0]);
const second = need(snapshot.caseStudies[1]);

/** What the API answers with one case study in the database, renamed, and no proof figures. */
function database(): WorkIndexView {
  const industry = snapshot.filters.industries.find((term) => term.slug === first.industry);
  return {
    copy: { ...snapshot.copy, title: 'Test work title from the database' },
    caseStudies: [{ ...first, clientName: 'Test client from the database', industry: industry?.slug ?? null }],
    filters: {
      industries: industry ? [industry] : [],
      services: snapshot.filters.services.filter((term) => first.services.includes(term.slug)),
      platforms: snapshot.filters.platforms.filter((term) => first.platforms.includes(term.slug)),
    },
    proof: { statistics: [], rating: null },
  };
}

describe('the work getters in the launch mode, database first', () => {
  it('list the database’s case studies first and the snapshot’s it does not have after them', async () => {
    respond({ '/pages/work': database() });
    const { getWorkIndex } = await load('services,work');
    const index = await getWorkIndex();

    expect(index.copy.title).toBe('Test work title from the database');
    expect(index.caseStudies.map((study) => study.slug)).toEqual(snapshot.caseStudies.map((study) => study.slug));
    expect(index.caseStudies[0]?.clientName).toBe('Test client from the database');
    // The filters are the snapshot's, because together the two lists carry the same terms.
    expect(index.filters).toEqual(snapshot.filters);
    // No figures in the database yet, so the band stays the approved one.
    expect(index.proof).toEqual(snapshot.proof);
  });

  it('render a case study from the database, and fall back to the snapshot when it has none', async () => {
    const approved = workCaseStudyViewSchema.parse(workCaseStudySnapshots[first.slug]);
    respond({ [`/pages/work/${second.slug}`]: { ...workCaseStudySnapshots[second.slug] as object, title: 'Test title from the database' } });
    const { getCaseStudy } = await load('work');

    expect((await getCaseStudy(second.slug))?.title).toBe('Test title from the database');
    expect(await getCaseStudy(first.slug)).toEqual(approved);
    expect(await getCaseStudy('no-such-study')).toBeNull();
  });

  it('keep reading only the snapshot while the family is not named', async () => {
    const fetchMock = respond({});
    const { getWorkIndex } = await load('services,industries');
    expect(await getWorkIndex()).toEqual(snapshot);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('/before-and-after/ and the homepage’s comparison, database first (decision 70)', () => {
  const approved = workBeforeAndAfterViewSchema.parse(workBeforeAndAfterSnapshot);
  const home = homePageViewSchema.parse(staticHome);

  /** What the API answers after the import, with the comparison edited in the dashboard. */
  function edited(overrides: Partial<WorkComparison> = {}): WorkBeforeAndAfterView {
    const [first] = approved.comparisons;
    if (!first) throw new Error('the before and after snapshot needs a comparison');
    return {
      ...approved,
      comparisons: [
        { ...first, summary: 'Test summary from the dashboard.', metrics: [{ label: 'Test measure', before: '1', after: '2' }], ...overrides },
      ],
    };
  }

  async function loadBoth(families: string) {
    const work = await load(families);
    const index = await import('./index');
    return { ...work, ...index };
  }

  it('reads the page from the database, and gives the homepage the comparison it marks', async () => {
    const database = edited();
    respond({ '/pages/before-and-after': database, '/pages/copy/home.content': home.content });
    const { getBeforeAndAfter, getHomePage } = await loadBoth('home,before-and-after');

    expect(await getBeforeAndAfter()).toEqual(database);
    const page = await getHomePage();
    expect(page.beforeAfter).toEqual(homepageComparison(database));
    expect(page.beforeAfter?.metrics).toEqual([{ label: 'Test measure', before: '1', after: '2' }]);
    // The rest of the homepage's proof is still the snapshot's.
    expect(page.projects).toEqual(home.projects);
  });

  it('shows no comparison on the homepage when the database marks none', async () => {
    respond({ '/pages/before-and-after': edited({ onHomepage: false }) });
    const { getHomePage } = await loadBoth('before-and-after');
    expect((await getHomePage()).beforeAfter).toBeNull();
  });

  it('keeps both snapshots, which agree, while the family is not named', async () => {
    const fetchMock = respond({});
    const { getBeforeAndAfter, getHomePage } = await loadBoth('work');
    expect(await getBeforeAndAfter()).toEqual(approved);
    expect((await getHomePage()).beforeAfter).toEqual(homepageComparison(approved));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
