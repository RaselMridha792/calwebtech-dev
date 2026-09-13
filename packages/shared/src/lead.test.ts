import { describe, expect, it } from 'vitest';
import { leadSubmissionSchema } from './lead';
import { toFieldErrors } from './validation';

const valid = {
  type: 'PROJECT',
  formId: 'lp-hero',
  name: 'Dana Whitfield',
  email: '  Dana@Company.COM ',
};

describe('leadSubmissionSchema', () => {
  it('normalises email and defaults optional collections', () => {
    const lead = leadSubmissionSchema.parse(valid);
    expect(lead.email).toBe('dana@company.com');
    expect(lead.serviceInterest).toEqual([]);
    expect(lead.attribution).toEqual({});
  });

  it('treats blank optional fields from a form post as absent', () => {
    const lead = leadSubmissionSchema.parse({ ...valid, company: '  ', budgetBand: '' });
    expect(lead.company).toBeUndefined();
    expect(lead.budgetBand).toBeUndefined();
  });

  it('adds a scheme to a bare website address', () => {
    const lead = leadSubmissionSchema.parse({ ...valid, siteUrl: 'halloway.com' });
    expect(lead.siteUrl).toBe('https://halloway.com');
  });

  it('rejects a website without a real hostname', () => {
    const result = leadSubmissionSchema.safeParse({ ...valid, siteUrl: 'not a site' });
    expect(result.success).toBe(false);
  });

  it('reports field-level messages for invalid input', () => {
    const result = leadSubmissionSchema.safeParse({ ...valid, name: 'D', email: 'nope' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = toFieldErrors(result.error);
    expect(errors.name).toEqual(['Enter your full name']);
    expect(errors.email).toEqual(['Enter a valid email address']);
  });

  it('rejects budget bands that are not segmentation keys', () => {
    const result = leadSubmissionSchema.safeParse({ ...valid, budgetBand: '$1M' });
    expect(result.success).toBe(false);
  });
});
