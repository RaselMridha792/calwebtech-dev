import { describe, expect, it } from 'vitest';
import {
  GUIDES_GLOSSARY_SETTING_KEYS,
  GUIDES_ROUTE,
  GLOSSARY_ROUTE,
  glossaryAnswer,
  glossaryGroups,
  glossaryLetter,
  glossaryTermPath,
  glossaryTermViewSchema,
  guideDetailViewSchema,
  guidePath,
  guideSummarySections,
  guidesIndexViewSchema,
  splitParagraphs,
  splitSentences,
} from './guides-glossary';

const GUIDE_VIEW = {
  slug: 'core-web-vitals-guide',
  title: 'The Core Web Vitals guide',
  updatedAt: '2026-09-15T00:00:00.000Z',
  seo: { title: 'Core Web Vitals guide', description: 'What the three metrics measure and how to pass them.' },
  answerBlock:
    'Core Web Vitals are three field measurements Google uses to describe page experience. A page passes when the seventy-fifth percentile of real visits meets each threshold. This guide explains what moves each one on a business website.',
  hero: {
    intro: 'Written for the person who has been handed a failing report and asked what it costs to fix.',
    pageCountLabel: '28 pages',
    formatLabel: 'PDF',
    ctaLabel: 'Get the guide',
    cover: { src: '/media/guide.webp', alt: 'A performance report on a laptop' },
  },
  summary: {
    heading: 'What does this guide cover?',
    intro: null,
    sections: [
      { id: 'section-1', heading: null, paragraphs: ['An opening paragraph of the summary.'], bullets: [] },
      { id: 'section-2', heading: 'What is a good LCP?', paragraphs: ['Under 2.5 seconds at p75.'], bullets: ['Preload the hero image'] },
    ],
  },
  takeaways: { heading: 'What should I take away?', items: ['One', 'Two', 'Three'] },
  gate: {
    heading: 'How do I get the full guide?',
    intro: 'Tell us where to send it.',
    submitLabel: 'Send me the guide',
    footnote: 'We store your email in our own database.',
    fileUrl: '/guides/core-web-vitals-guide.pdf',
    fileLabel: 'PDF, 28 pages',
    success: { heading: 'Here it is.', body: 'Your download is ready.', downloadLabel: 'Download the guide' },
  },
  faq: null,
  service: null,
  related: null,
};

const TERM_VIEW = {
  slug: 'headless-cms',
  term: 'Headless CMS',
  letter: 'H',
  updatedAt: '2026-09-15T00:00:00.000Z',
  seo: { title: 'Headless CMS', description: 'What a headless CMS is and when it is worth the extra moving parts.' },
  definition: 'A headless CMS stores and edits content but does not render the pages that display it.',
  answerBlock:
    'A headless CMS stores and edits content but does not render the pages that display it. The website reads that content over an API and decides how it looks. That separation is what lets one set of records feed a website, an app and a shop.',
  body: { heading: 'What does a headless CMS actually do?', paragraphs: ['A first paragraph.', 'A second paragraph.'] },
  commercial: null,
  example: null,
  service: null,
  related: null,
};

describe('guides and glossary routes', () => {
  it('build lowercase, hyphenated, trailing-slash paths', () => {
    expect(GUIDES_ROUTE).toBe('/guides/');
    expect(GLOSSARY_ROUTE).toBe('/glossary/');
    expect(guidePath('core-web-vitals-guide')).toBe('/guides/core-web-vitals-guide/');
    expect(glossaryTermPath('headless-cms')).toBe('/glossary/headless-cms/');
  });

  it('names its settings after the pages they hold', () => {
    expect(GUIDES_GLOSSARY_SETTING_KEYS).toEqual({ guides: 'guides.index', glossary: 'glossary.index' });
  });
});

describe('guideSummarySections', () => {
  it('turns a summary column into sections, questions as headings and "- " lines as bullets', () => {
    const sections = guideSummarySections(
      [
        'The opening paragraph, before any heading.',
        'What does a rebuild cost?',
        'It depends on scope.\nA second line of the same paragraph.',
        '- Page count\n- Integrations',
        'Another paragraph in the same section.',
      ].join('\n\n'),
    );
    expect(sections).toEqual([
      { id: 'section-1', heading: null, paragraphs: ['The opening paragraph, before any heading.'], bullets: [] },
      {
        id: 'section-2',
        heading: 'What does a rebuild cost?',
        paragraphs: ['It depends on scope. A second line of the same paragraph.', 'Another paragraph in the same section.'],
        bullets: ['Page count', 'Integrations'],
      },
    ]);
  });

  it('does not treat a long question or a two-sentence block as a heading', () => {
    const long = `Why does ${'a very long question '.repeat(9)}cost so much?`;
    const [section] = guideSummarySections(`${long}\n\nIs this a heading? It is not, because it is two sentences.`);
    expect(section?.heading).toBeNull();
    expect(section?.paragraphs).toHaveLength(2);
  });

  it('returns nothing for an empty summary', () => {
    expect(guideSummarySections('   \n\n  ')).toEqual([]);
  });
});

describe('glossaryAnswer', () => {
  it('joins the definition with enough of the body to make two or three sentences', () => {
    const answer = glossaryAnswer(
      'A canonical tag tells search engines which URL is the one to index.',
      'It sits in the head of the page. Duplicate pages point at the same canonical.\n\nA second paragraph.',
    );
    expect(answer).toBe(
      'A canonical tag tells search engines which URL is the one to index. It sits in the head of the page. Duplicate pages point at the same canonical.',
    );
  });

  it('is null when the record cannot make a complete answer block', () => {
    expect(glossaryAnswer('Too short.', 'Also short.')).toBeNull();
  });
});

describe('glossary grouping', () => {
  it('files a term under the first letter of its term, and anything else under "#"', () => {
    expect(glossaryLetter('headless CMS')).toBe('H');
    expect(glossaryLetter('301 redirect')).toBe('#');
  });

  it('groups A to Z with "#" last, and sorts the terms inside each letter', () => {
    const card = (term: string) => ({ slug: term.toLowerCase().replace(/\s+/g, '-'), term, definition: 'A definition.' });
    expect(glossaryGroups([card('Bounce rate'), card('301 redirect'), card('API'), card('Answer engine')])).toEqual([
      // Locale order, so "Answer engine" files before "API" rather than after it.
      { letter: 'A', terms: [card('Answer engine'), card('API')] },
      { letter: 'B', terms: [card('Bounce rate')] },
      { letter: '#', terms: [card('301 redirect')] },
    ]);
  });
});

describe('text helpers', () => {
  it('splits paragraphs on blank lines and collapses whitespace', () => {
    expect(splitParagraphs('One\nline.\n\n\n  Two.  \n\n')).toEqual(['One line.', 'Two.']);
  });

  it('splits sentences without breaking on Next.js or 2.5s', () => {
    expect(splitSentences('We use Next.js 16. It renders in 2.5s. That is the budget.')).toEqual([
      'We use Next.js 16.',
      'It renders in 2.5s.',
      'That is the budget.',
    ]);
  });
});

describe('view contracts', () => {
  it('accept a complete guide and a complete term', () => {
    expect(guideDetailViewSchema.parse(GUIDE_VIEW).gate.fileUrl).toBe('/guides/core-web-vitals-guide.pdf');
    expect(glossaryTermViewSchema.parse(TERM_VIEW).letter).toBe('H');
  });

  it('reject a section heading that is not a question, and a definition that is empty', () => {
    const view = structuredClone(GUIDE_VIEW);
    view.summary.sections[1] = { ...view.summary.sections[1], heading: 'Largest Contentful Paint' } as never;
    expect(guideDetailViewSchema.safeParse(view).success).toBe(false);
    expect(glossaryTermViewSchema.safeParse({ ...TERM_VIEW, definition: '  ' }).success).toBe(false);
  });

  it('accept an index with no records, so the page can render an empty state', () => {
    const content = {
      seo: { title: 'Guides', description: 'Long-form guides for people planning a website project.' },
      title: 'Guides and white papers',
      answerBlock:
        'Our guides are long-form answers to the questions that come up when a company plans a website. Each one is free, and the summary on the page is the whole argument. The download adds the worksheets and checklists.',
      intro: 'Every guide is written by the people who do the work.',
      list: { heading: 'Which guides can I read?', empty: 'No guides are published yet.', cardLinkLabel: 'Read the summary' },
      gateNote: { heading: 'Do I have to give my email?', body: 'Only for the download. The summary on each page is complete.' },
      elsewhere: {
        heading: 'What if a guide is not what I need?',
        body: 'Ask us the question directly.',
        primaryCta: { label: 'Contact us', href: '/contact/' },
      },
    };
    expect(guidesIndexViewSchema.parse({ content, guides: [] }).guides).toEqual([]);
  });
});
