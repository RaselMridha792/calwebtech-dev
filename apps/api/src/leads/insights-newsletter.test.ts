import {
  INSIGHTS_NEWSLETTER_FORM_ID,
  insightsCopySchema,
  leadSubmissionSchema,
  type InsightsCopyInput,
} from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACKNOWLEDGEMENT, newsletterAcknowledgement } from './leads.service';

const SUCCESS = { heading: 'You are subscribed.', body: 'The next article comes by email within a fortnight.' };

/** The shape the `insights.copy` setting holds; only the subscribe block matters here. */
const COPY: InsightsCopyInput = {
  index: {
    seo: { title: 'Insights', description: 'Articles for people buying a website.' },
    title: 'Insights',
    featuredLabel: 'Start here',
    listHeading: 'Which article answers your question?',
    topicsLabel: 'Topics',
    allTopicsLabel: 'All topics',
    readingTimeLabel: 'min read',
    cardLinkLabel: 'Read the article',
    empty: 'Nothing is published here yet.',
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
      eyebrow: 'The service behind this article',
      body: 'This is the work behind the article.',
      linkLabel: 'See the service',
      contactCta: { label: 'Tell us what you need', href: '/contact/' },
    },
    servicesHeading: 'Which services put this into practice?',
    caseStudyLinkLabel: 'Read the case study',
    relatedHeading: 'What should you read next?',
    relatedLink: { label: 'All insights', href: '/insights/' },
    newsletter: {
      heading: 'Would you like the next article by email?',
      body: 'One article a fortnight.',
      nameLabel: 'Full name',
      emailLabel: 'Work email',
      submitLabel: 'Subscribe',
      privacyNote: 'Your details stay in our own database.',
      success: SUCCESS,
      unavailable: 'We could not send that just now.',
    },
  },
  categoryFallback: {
    seoTitle: '{topic} articles',
    seoDescription: 'Articles about {topic}.',
    title: '{topic}',
    listHeading: 'Which articles cover {topic}?',
  },
  categories: {},
};

const submission = (overrides: Record<string, unknown> = {}) => ({
  type: 'RESOURCE',
  formId: INSIGHTS_NEWSLETTER_FORM_ID,
  name: 'Jordan Blake',
  email: 'jordan@example.com',
  ...overrides,
});

describe('the inline subscribe block on an article', () => {
  it('answers with the insights copy, so the email repeats what the subscriber saw', () => {
    expect(newsletterAcknowledgement(insightsCopySchema.parse(COPY))).toEqual(SUCCESS);
  });

  it('falls back to the default acknowledgement when the setting is missing or malformed', () => {
    expect(newsletterAcknowledgement(null)).toEqual(DEFAULT_ACKNOWLEDGEMENT);
    expect(newsletterAcknowledgement({ article: {} })).toEqual(DEFAULT_ACKNOWLEDGEMENT);
  });

  it('stores the article the block was filled on, and refuses anything that is not a site path', () => {
    const accepted = leadSubmissionSchema.safeParse(submission({ sourcePage: '/insights/the-page-builder-tax/' }));
    expect(accepted.success && accepted.data.sourcePage).toBe('/insights/the-page-builder-tax/');

    for (const sourcePage of ['https://example.com/insights/', 'insights/', '/Insights/', '/insights/?page=2']) {
      expect(leadSubmissionSchema.safeParse(submission({ sourcePage })).success, sourcePage).toBe(false);
    }
  });

  it('leaves the source page off when the block does not send one', () => {
    const parsed = leadSubmissionSchema.safeParse(submission({ sourcePage: '' }));
    expect(parsed.success && parsed.data.sourcePage).toBeUndefined();
  });
});
