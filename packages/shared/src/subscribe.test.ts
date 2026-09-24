import { describe, expect, it } from 'vitest';
import { homePageContentSchema } from './home-page';
import {
  DEFAULT_SUBSCRIBE_COPY,
  SUBSCRIBE_SOURCE_HOME,
  subscribeCopySchema,
  subscribeResultSchema,
  subscribeSubmissionSchema,
} from './subscribe';

describe('what a visitor can submit to subscribe', () => {
  it('needs an email address and nothing else', () => {
    const parsed = subscribeSubmissionSchema.parse({ email: 'dana@company.com' });
    expect(parsed).toEqual({ email: 'dana@company.com', sourcePage: SUBSCRIBE_SOURCE_HOME });
  });

  it('lower-cases and trims the address, so two spellings are one person', () => {
    expect(subscribeSubmissionSchema.parse({ email: '  Dana@Company.COM ' }).email).toBe('dana@company.com');
  });

  it('refuses what is not an address', () => {
    for (const email of ['', 'not-an-email', 'a@b', 'a b@c.com', 'x'.repeat(260) + '@c.com']) {
      expect(subscribeSubmissionSchema.safeParse({ email }).success, email).toBe(false);
    }
  });

  it('keeps a source page that is a path on this site, and refuses anything else', () => {
    expect(subscribeSubmissionSchema.parse({ email: 'a@b.co', sourcePage: '/insights/some-post/' }).sourcePage).toBe(
      '/insights/some-post/',
    );
    // A URL, a script and a page without a leading slash would all end up in a segment rule.
    for (const sourcePage of ['https://evil.example/', 'javascript:alert(1)', 'insights', '/a b', '/<script>']) {
      expect(subscribeSubmissionSchema.safeParse({ email: 'a@b.co', sourcePage }).success, sourcePage).toBe(false);
    }
  });

  it('carries the honeypot and the bot-check token when they are sent', () => {
    const parsed = subscribeSubmissionSchema.parse({ email: 'a@b.co', referenceCode: 'spam', turnstileToken: 'tok' });
    expect(parsed.referenceCode).toBe('spam');
    expect(parsed.turnstileToken).toBe('tok');
  });
});

describe('the answer', () => {
  it('is one shape for every outcome, so an address cannot be probed', () => {
    expect(subscribeResultSchema.parse({ status: 'subscribed' })).toEqual({ status: 'subscribed' });
    expect(subscribeResultSchema.safeParse({ status: 'already_subscribed' }).success).toBe(false);
    expect(subscribeResultSchema.safeParse({ status: 'suppressed' }).success).toBe(false);
  });
});

describe("the band's copy", () => {
  it('has words for every state, and the default is valid', () => {
    expect(subscribeCopySchema.safeParse(DEFAULT_SUBSCRIBE_COPY).success).toBe(true);
    expect(DEFAULT_SUBSCRIBE_COPY.heading).toBe('Subscribe now');
  });

  it('promises only what happens: no confirmation email, since none is sent', () => {
    // A success line that says "check your inbox" would be false until double opt-in exists.
    expect(DEFAULT_SUBSCRIBE_COPY.success).not.toMatch(/inbox|confirm|check your/i);
  });

  it('is optional on a stored homepage, so one saved before the band existed still parses', () => {
    const shape = homePageContentSchema.shape.subscribe;
    expect(shape.parse(undefined)).toEqual(DEFAULT_SUBSCRIBE_COPY);
  });
});
