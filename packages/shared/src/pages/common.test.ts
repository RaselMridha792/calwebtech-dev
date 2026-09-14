import { describe, expect, it } from 'vitest';
import { answerBlockSchema, countSentences, faqItemSchema, pageSeoSchema, questionSchema } from './common';

describe('countSentences', () => {
  it('counts sentence endings, not the dots inside names and figures', () => {
    expect(countSentences('')).toBe(0);
    expect(countSentences('We build on Next.js and load in 1.2s on mobile.')).toBe(1);
    expect(countSentences('One sentence. Two sentences? Three!')).toBe(3);
    expect(countSentences('It costs more. "Why?" Because of scope.')).toBe(3);
  });
});

describe('answerBlockSchema', () => {
  const two =
    'A custom website is designed and built for your business rather than adapted from a theme. It usually takes six to fourteen weeks, depending on integrations.';

  it('accepts two or three complete sentences', () => {
    expect(answerBlockSchema.safeParse(two).success).toBe(true);
    expect(answerBlockSchema.safeParse(`${two} The price is fixed after discovery.`).success).toBe(true);
  });

  it('rejects one sentence, four sentences, or copy without a closing full stop', () => {
    expect(answerBlockSchema.safeParse('A custom website is designed and built for your business rather than adapted from a theme.').success).toBe(false);
    expect(answerBlockSchema.safeParse(`${two} The price is fixed. Support is monthly.`).success).toBe(false);
    expect(answerBlockSchema.safeParse(two.slice(0, -1)).success).toBe(false);
  });
});

describe('questionSchema and faqItemSchema', () => {
  it('require headings and questions to be written as questions', () => {
    expect(questionSchema().safeParse('How much does a website cost?').success).toBe(true);
    expect(questionSchema().safeParse('Website cost').success).toBe(false);
    expect(faqItemSchema.safeParse({ id: 'a', question: 'Do you sign NDAs', answer: 'Yes.' }).success).toBe(false);
  });
});

describe('pageSeoSchema', () => {
  it('holds titles to 60 characters and descriptions to 155', () => {
    expect(pageSeoSchema.safeParse({ title: 'x'.repeat(61), description: 'Fine.' }).success).toBe(false);
    expect(pageSeoSchema.safeParse({ title: 'Fine', description: 'x'.repeat(156) }).success).toBe(false);
    expect(pageSeoSchema.parse({ title: 'Fine', description: 'Fine.' }).ogImage).toBeNull();
  });
});
