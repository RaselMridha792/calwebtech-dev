import { describe, expect, it } from 'vitest';
import {
  INSIGHTS_PAGE_SIZE,
  articleBodyProblems,
  articleLinkedSlugs,
  articleOutline,
  articleToc,
  articleWordCount,
  headingId,
  insightsCategoryCopyFor,
  insightsCategoryCopySchema,
  insightsCopySchema,
  insightsListPath,
  paginate,
  plainInline,
  readInsightsPage,
  readingMinutes,
  splitKeyTakeaways,
} from './insights';

const BODY = [
  '## What does a redesign cost?',
  '',
  'Most projects land between two bands, and the [website redesign](/services/website-redesign/) page',
  'sets them out. [Northmark Supply](/work/northmark-supply/) sat at the top of the first one.',
  '',
  '| Band | Typical scope |',
  '| --- | --- |',
  '| First | A marketing site |',
  '',
  '### What moves the number?',
  '',
  'Integrations, mostly. See [Next.js development](/services/nextjs-development/).',
  '',
  '```',
  '## not a heading',
  '```',
].join('\n');

describe('article Markdown helpers', () => {
  it('reads the headings a reader sees, with unique anchors, and ignores fenced code', () => {
    expect(articleOutline(BODY)).toEqual([
      { level: 2, title: 'What does a redesign cost?', id: 'what-does-a-redesign-cost' },
      { level: 3, title: 'What moves the number?', id: 'what-moves-the-number' },
    ]);
  });

  it('gives repeated headings distinct anchors', () => {
    const used = new Map<string, number>();
    expect(headingId('What next?', used)).toBe('what-next');
    expect(headingId('What next?', used)).toBe('what-next-2');
  });

  it('strips inline Markdown from headings and takeaways', () => {
    expect(plainInline('What does **a redesign** cost in `2026`?')).toBe('What does a redesign cost in 2026?');
    expect(plainInline('Read the [pricing page](/pricing/)')).toBe('Read the pricing page');
    expect(plainInline('Keep snake_case names and 3 * 4 intact')).toBe('Keep snake_case names and 3 * 4 intact');
  });

  it('counts the words a reader reads, not the syntax', () => {
    expect(articleWordCount('A [linked phrase](/services/website-redesign/) and **bold** words.')).toBe(6);
    expect(articleWordCount('Next.js costs $12,000 to $25,000.')).toBe(5);
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(1540)).toBe(7);
  });

  it('lifts the key takeaways out of the body and leaves the rest untouched', () => {
    const parts = splitKeyTakeaways(
      ['## Key takeaways', '', '- The first thing, with a [link](/pricing/).', '- The second thing.', '', BODY].join('\n'),
    );
    expect(parts.takeaways).toEqual(['The first thing, with a link.', 'The second thing.']);
    expect(parts.body).toBe(BODY);
    expect(splitKeyTakeaways(BODY)).toEqual({ body: BODY, takeaways: [] });
  });

  it('reads the service and case study pages an article links to, each once and in order', () => {
    expect(articleLinkedSlugs(BODY, '/services/')).toEqual(['website-redesign', 'nextjs-development']);
    expect(articleLinkedSlugs(BODY, '/work/')).toEqual(['northmark-supply']);
  });

  it('accepts a body of question headings and reports every other shape', () => {
    expect(articleBodyProblems(BODY)).toEqual([]);
    expect(articleBodyProblems('# A title\n\nBody.')[0]).toMatch(/only H1/);
    expect(articleBodyProblems('## Costs\n\nBody.')[0]).toMatch(/not a question/);
    expect(articleBodyProblems('### Why?\n\nBody.')[0]).toMatch(/before any H2/);
    expect(articleBodyProblems('## Why?\n\n#### Deeper?\n\nBody.')[0]).toMatch(/deeper than H3/);
    expect(articleBodyProblems('## Key takeaways\n\n- One.')[0]).toMatch(/rendered above the article/);
    expect(articleBodyProblems('A heading\n===\n\nBody.')[0]).toMatch(/line of = or -/);
    expect(articleBodyProblems('## Why?\n\n<script>alert(1)</script>')[0]).toMatch(/HTML is not rendered/);
  });

  it('shows a table of contents only past the length that needs one', () => {
    const short = { body: BODY, wordCount: 400 };
    expect(articleToc(short)).toEqual([]);
    expect(articleToc({ body: BODY, wordCount: 1400 })).toHaveLength(2);
  });
});

describe('listing URLs and pagination', () => {
  it('writes the topic into the path and the page into the query', () => {
    expect(insightsListPath(null)).toBe('/insights/');
    expect(insightsListPath('strategy')).toBe('/insights/strategy/');
    expect(insightsListPath('strategy', 2)).toBe('/insights/strategy/?page=2');
  });

  it('reads the page from the URL, and refuses anything that is not a page number', () => {
    expect(readInsightsPage({})).toBe(1);
    expect(readInsightsPage({ page: '3' })).toBe(3);
    expect(readInsightsPage({ page: '0' })).toBeNull();
    expect(readInsightsPage({ page: 'two' })).toBeNull();
    expect(readInsightsPage({ page: ['1', '2'] })).toBeNull();
  });

  it('pages a list, keeps one page for an empty list and refuses a page past the end', () => {
    const items = Array.from({ length: INSIGHTS_PAGE_SIZE + 3 }, (_, index) => index);
    expect(paginate(items, 1)?.items).toHaveLength(INSIGHTS_PAGE_SIZE);
    expect(paginate(items, 2)).toEqual({ items: [12, 13, 14], page: 2, pageCount: 2 });
    expect(paginate(items, 3)).toBeNull();
    expect(paginate([], 1)).toEqual({ items: [], page: 1, pageCount: 1 });
  });
});

const COPY = insightsCopySchema.parse({
  index: {
    seo: { title: 'Insights', description: 'Articles for people buying a website.' },
    title: 'Insights',
    featuredLabel: 'Featured',
    listHeading: 'What have we written lately?',
    topicsLabel: 'Topics',
    allTopicsLabel: 'All topics',
    readingTimeLabel: 'min read',
    cardLinkLabel: 'Read the article',
    empty: 'No articles are published yet.',
    pagination: { label: 'Pages', previous: 'Previous', next: 'Next', status: 'Page {page} of {pages}' },
  },
  article: {
    byLabel: 'By',
    publishedLabel: 'Published',
    updatedLabel: 'Updated',
    readingTimeLabel: 'min read',
    tocLabel: 'On this page',
    takeawaysLabel: 'Key takeaways',
    authorLabel: 'About the author',
    serviceCta: {
      eyebrow: 'Related service',
      body: 'This is the service behind the article.',
      linkLabel: 'See the service',
      contactCta: { label: 'Tell us what you need', href: '/contact/' },
    },
    servicesHeading: 'Which services put this into practice?',
    caseStudyLinkLabel: 'Read the case study',
    relatedHeading: 'What should you read next?',
    relatedLink: { label: 'All insights', href: '/insights/' },
    newsletter: {
      heading: 'Want the next one by email?',
      body: 'One article a month.',
      nameLabel: 'Full name',
      emailLabel: 'Work email',
      submitLabel: 'Subscribe',
      privacyNote: 'We store your details in our own database.',
      success: { heading: 'You are on the list.', body: 'The next article comes by email.' },
      unavailable: 'We could not send that just now.',
    },
  },
  categoryFallback: {
    seoTitle: '{topic} articles',
    seoDescription: 'Articles about {topic} for people buying a website.',
    title: '{topic}',
    listHeading: 'Which articles cover this topic?',
  },
  categories: {
    strategy: {
      seo: { title: 'Strategy articles', description: 'How to plan a website project.' },
      title: 'Strategy',
      listHeading: 'Which strategy articles are published?',
    },
  },
});

describe('topic copy', () => {
  it('uses a topic’s own copy when it has some', () => {
    expect(insightsCategoryCopyFor(COPY, { slug: 'strategy', name: 'Strategy' }).seo.title).toBe('Strategy articles');
  });

  it('fills the fallback for a topic nobody has written copy for', () => {
    const copy = insightsCategoryCopyFor(COPY, { slug: 'ai-search', name: 'AI search' });
    expect(copy.title).toBe('AI search');
    expect(copy.seo.description).toBe('Articles about AI search for people buying a website.');
  });

  it('does not read a topic slug off Object.prototype', () => {
    expect(insightsCategoryCopyFor(COPY, { slug: 'constructor', name: 'Constructor' }).title).toBe('Constructor');
  });

  // A topic name is up to 60 characters and so is the editor-written SEO title, so the two
  // together overflow long before either is unreasonable. It runs inside the index mapper:
  // a throw here would take /insights/, every topic page and every article page down at once.
  it('gives a long topic name a page instead of throwing', () => {
    const name = 'Search engine optimisation and AI answer visibility';
    const copy = insightsCategoryCopyFor(COPY, { slug: 'seo-and-ai-answer-visibility', name });
    expect(insightsCategoryCopySchema.safeParse(copy).success).toBe(true);
    expect(copy.seo.title.length).toBeLessThanOrEqual(60);
    expect(copy.seo.description.length).toBeLessThanOrEqual(155);
  });

  it('keeps the list heading a question when it has to be cut', () => {
    const longCopy = insightsCopySchema.parse({
      ...COPY,
      categoryFallback: {
        ...COPY.categoryFallback,
        seoTitle: 'Every article we have published about {topic}, in one place',
        listHeading: 'Which of our articles cover {topic} for a business buying a new website this year?',
      },
    });
    const copy = insightsCategoryCopyFor(longCopy, {
      slug: 'conversion-rate-optimisation',
      name: 'Conversion rate optimisation and analytics',
    });
    expect(insightsCategoryCopySchema.safeParse(copy).success).toBe(true);
    expect(copy.listHeading.length).toBeLessThanOrEqual(160);
    expect(copy.listHeading.endsWith('?')).toBe(true);
  });

  it('falls back to safe copy when nothing can be filled', () => {
    const copy = insightsCategoryCopyFor(COPY, { slug: 'unnamed', name: '   ' });
    expect(insightsCategoryCopySchema.safeParse(copy).success).toBe(true);
    expect(copy.intro).toBeNull();
    expect(copy.listHeading).toBe(COPY.index.listHeading);
  });
});
