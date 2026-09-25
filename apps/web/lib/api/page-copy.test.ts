import {
  homePageViewSchema,
  siteChromeViewSchema,
  staticThankYouPageSchema,
  staticThankYouViewSchema,
  type HomePageContent,
} from '@calwebtech/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import staticHome from '@/static-content/home.json';
import staticChrome from '@/static-content/site-chrome.json';
import { staticThankYouSnapshots } from '@/static-content/static';

vi.mock('server-only', () => ({}));

/**
 * Page copy from the dashboard laid over the snapshots (docs/08-decisions.md, 59): the
 * homepage's words, the chrome built from them on every page, and the thank-you pages. With
 * the approved copy stored, every page is the committed one, so switching a family on
 * changes nothing until somebody edits.
 */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function load(first: string) {
  vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000');
  vi.stubEnv('CONTENT_SOURCE', 'snapshot');
  vi.stubEnv('CONTENT_DATABASE_FIRST', first);
  const [index, site, statics] = await Promise.all([import('./index'), import('./site'), import('./static')]);
  return { ...index, ...site, ...statics };
}

function respond(routes: Record<string, unknown>) {
  const fetchMock = vi.fn((url: string) => {
    const hit = Object.entries(routes).find(([path]) => url.endsWith(path));
    return Promise.resolve(Response.json(hit?.[1] ?? {}, { status: hit ? 200 : 404 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const home = homePageViewSchema.parse(staticHome);
const chrome = siteChromeViewSchema.parse(staticChrome);
const contactPage = staticThankYouViewSchema.parse(staticThankYouSnapshots.contact);

/** The thank-you copy as the import stores it: the shared copy and every page. */
function thankYouCopy(edit: (title: string, type: string) => string = (title) => title) {
  const pages = Object.values(staticThankYouSnapshots).map((snapshot) => {
    const page = staticThankYouPageSchema.parse(snapshot);
    return { ...page, title: edit(page.title, page.type) };
  });
  return { image: contactPage.image, callLabel: contactPage.callLabel, pages };
}

describe('page copy laid over the snapshots', () => {
  it('changes nothing while the approved copy is what is stored', async () => {
    respond({ '/pages/copy/home.content': home.content, '/pages/copy/static.thank-you': thankYouCopy() });
    const { getHomePage, getSiteChrome, getStaticThankYou } = await load('home,thank-you');
    expect(await getHomePage()).toEqual(home);
    expect(await getSiteChrome()).toEqual(chrome);
    expect(await getStaticThankYou('contact')).toEqual(contactPage);
  });

  it('shows the homepage’s edited words, and the footer built from them on every page', async () => {
    const content: HomePageContent = {
      ...home.content,
      hero: { ...home.content.hero, heading: 'Test headline from the dashboard' },
      footer: { ...home.content.footer, contactEmail: 'test-footer@example.com' },
    };
    respond({ '/pages/copy/home.content': content });
    const { getHomePage, getSiteChrome } = await load('home');

    const page = await getHomePage();
    expect(page.content.hero.heading).toBe('Test headline from the dashboard');
    expect(page.projects).toEqual(home.projects);
    expect((await getSiteChrome()).footer.contactEmail).toBe('test-footer@example.com');
  });

  it('builds a thank-you page from the edited copy, and keeps the snapshot for a type it lacks', async () => {
    const stored = thankYouCopy((title, type) => (type === 'contact' ? 'Test thank-you title' : title));
    stored.pages = stored.pages.filter((page) => page.type !== 'audit');
    respond({ '/pages/copy/static.thank-you': stored });
    const { getStaticThankYou } = await load('thank-you');

    expect((await getStaticThankYou('contact'))?.title).toBe('Test thank-you title');
    expect(await getStaticThankYou('audit')).toEqual(staticThankYouViewSchema.parse(staticThankYouSnapshots.audit));
    expect(await getStaticThankYou('no-such-type')).toBeNull();
  });

  it('asks for nothing while neither family is named', async () => {
    const fetchMock = respond({});
    const { getHomePage, getSiteChrome, getStaticThankYou } = await load('services');
    expect(await getHomePage()).toEqual(home);
    expect(await getSiteChrome()).toEqual(chrome);
    expect(await getStaticThankYou('contact')).toEqual(contactPage);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
