import { describe, expect, it } from 'vitest';
import { plainErrors } from './plain-errors';

describe('plainErrors', () => {
  it('shows a schema’s own message alone where the field has one', () => {
    expect(
      plainErrors({
        heading: ['Too small: expected string to have >=1 characters', 'Write it as a question a buyer would type, ending with "?"'],
        'before.src': ['Too small: expected string to have >=1 characters', 'Must be a URL or a site path'],
      }),
    ).toEqual({
      heading: ['Write it as a question a buyer would type, ending with "?"'],
      'before.src': ['Must be a URL or a site path'],
    });
  });

  it('translates the validator’s own words where the field has nothing else', () => {
    expect(
      plainErrors({
        'metrics.0.label': ['Too small: expected string to have >=1 characters'],
        'metrics.0.after': ['Too big: expected string to have <=20 characters'],
        'before.width': ['Too small: expected number to be >0'],
      }),
    ).toEqual({
      'metrics.0.label': ['This cannot be empty.'],
      'metrics.0.after': ['Keep this to 20 characters or fewer.'],
      'before.width': ['A whole number above 0.'],
    });
  });
});
