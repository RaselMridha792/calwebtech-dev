import { describe, expect, it } from 'vitest';
import { unfinishedCopy } from './copy-rules';
import home from './home.json';
import landing from './landing-b2b-website-design.json';
import chrome from './site-chrome.json';

describe('unfinishedCopy', () => {
  it('finds placeholder words and empty text, with where they are', () => {
    expect(
      unfinishedCopy({ hero: { heading: 'Placeholder headline', intro: ' ' }, faqs: [{ answer: 'Pricing TBD.' }] }),
    ).toEqual(['$.hero.heading: "Placeholder headline"', '$.hero.intro is empty', '$.faqs[0].answer: "Pricing TBD."']);
  });

  it('ignores identifiers, links and alt text, and whole words only', () => {
    expect(unfinishedCopy({ slug: 'todo', alt: 'A layout with grey placeholder blocks', body: 'Tbdx and Todoist' })).toEqual([]);
  });

  it('passes the approved snapshots', () => {
    expect(unfinishedCopy(home)).toEqual([]);
    expect(unfinishedCopy(landing)).toEqual([]);
    expect(unfinishedCopy(chrome)).toEqual([]);
  });
});
