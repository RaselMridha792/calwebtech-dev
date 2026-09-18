import type { Faq, Service } from '@calwebtech/db';
import { FORMS_PROJECT_STEPS, type FormsProjectContentInput } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { formsFaqItems, toFormsAuditView, toFormsProjectView } from './forms.mapper';

const note = 'Test copy.';
const answer = 'Test answer block that opens the page with a direct answer. It has a second sentence to count.';
const seo = { title: 'Test page', description: 'Test description.' };
const field = { label: 'Test label', hint: null, placeholder: null };
const titled = [{ title: 'Test item', body: note }];

let sequence = 0;
function faq(overrides: Partial<Faq> = {}): Faq {
  sequence += 1;
  return {
    id: `faq-${String(sequence)}`,
    question: 'Is this a test question?',
    answer: 'Test answer.',
    group: 'start-a-project',
    order: sequence,
    serviceId: null,
    industryId: null,
    locationId: null,
    landingPageId: null,
    ...overrides,
  };
}

function service(slug: string, title: string): Pick<Service, 'slug' | 'title'> {
  return { slug, title };
}

const projectContent: FormsProjectContentInput = {
  seo,
  hero: { eyebrow: 'Start a project', title: 'Start a project', answer, intro: note },
  backdrop: null,
  assurances: ['Test assurance'],
  form: {
    heading: 'What do we need from you?',
    intro: note,
    stepLabel: 'Step',
    ofLabel: 'of',
    backLabel: 'Back',
    nextLabel: 'Next',
    submitLabel: 'Send',
    savedLabel: 'Saved.',
    saveNote: note,
    uploadNote: note,
    footnote: note,
    servicesEmpty: 'Nothing published yet.',
    success: { heading: 'Sent.', body: note },
    steps: FORMS_PROJECT_STEPS.map((key) => ({ key, legend: 'What is this step about?', hint: note })),
    fields: {
      projectType: field,
      name: field,
      email: field,
      company: field,
      phone: field,
      siteUrl: field,
      serviceInterest: field,
      budgetBand: field,
      timeline: field,
      description: field,
      projectLinks: field,
    },
  },
  whatHappens: { heading: 'What happens next?', intro: note, steps: [{ title: 'Read', duration: 'Day 1', body: note }] },
  whatWeNeed: { heading: 'What do we need?', intro: note, items: ['Test item'], note },
  alternatives: {
    heading: 'Would you rather talk first?',
    intro: note,
    items: [{ title: 'Call', body: note, link: { label: 'Contact', href: '/contact/' } }],
  },
  faq: { heading: 'Any questions?', intro: note },
};

const auditContent = {
  seo,
  hero: { eyebrow: 'Free website audit', title: 'Free website audit', answer, intro: note },
  backdrop: null,
  assurances: ['Test assurance'],
  covers: { heading: 'What does the audit cover?', intro: note, items: titled },
  delivery: {
    heading: 'How is it delivered?',
    intro: note,
    steps: [{ title: 'Review', duration: 'Days 1 to 3', body: note }],
    image: null,
  },
  limits: { heading: 'What is it not?', intro: note, items: ['Test limit'] },
  form: {
    heading: 'Where should we look?',
    intro: note,
    submitLabel: 'Request the audit',
    footnote: note,
    success: { heading: 'Sent.', body: note },
    fields: {
      siteUrl: field,
      mainConcern: field,
      competitorUrl: field,
      name: field,
      email: field,
      company: field,
      description: field,
    },
  },
  faq: { heading: 'Any questions?', intro: note },
};

describe('toFormsProjectView', () => {
  it('builds the brief page from its setting, published services and questions', () => {
    const view = toFormsProjectView({
      contentSetting: projectContent,
      services: [service('website-redesign', 'Website redesign'), service('care-plans', 'Website care plans')],
      faqs: [faq()],
    });
    expect(view.content.form.steps.map((step) => step.key)).toEqual([...FORMS_PROJECT_STEPS]);
    expect(view.services).toEqual([
      { slug: 'website-redesign', title: 'Website redesign' },
      { slug: 'care-plans', title: 'Website care plans' },
    ]);
    expect(view.faqs).toHaveLength(1);
  });

  it('renders against an empty database: no services and no questions', () => {
    const view = toFormsProjectView({ contentSetting: projectContent, services: [], faqs: [] });
    expect(view.services).toEqual([]);
    expect(view.faqs).toEqual([]);
    expect(view.content.form.servicesEmpty.length).toBeGreaterThan(0);
  });

  it('fails the contract when the copy is missing or malformed, rather than rendering half a page', () => {
    expect(() => toFormsProjectView({ contentSetting: null, services: [], faqs: [] })).toThrow(ZodError);
    const noAnswer = { ...projectContent, hero: { ...projectContent.hero, answer: 'Too short.' } };
    expect(() => toFormsProjectView({ contentSetting: noAnswer, services: [], faqs: [] })).toThrow(ZodError);
  });
});

describe('toFormsAuditView', () => {
  it('builds the audit page from its setting and questions', () => {
    const view = toFormsAuditView({ contentSetting: auditContent, faqs: [faq({ group: 'free-website-audit' })] });
    expect(view.content.covers.items).toHaveLength(1);
    expect(view.faqs).toHaveLength(1);
  });

  it('fails the contract when a section heading is not a question buyers type', () => {
    const plain = { ...auditContent, covers: { ...auditContent.covers, heading: 'Audit coverage' } };
    expect(() => toFormsAuditView({ contentSetting: plain, faqs: [] })).toThrow(ZodError);
  });
});

describe('formsFaqItems', () => {
  it('leaves out rows that are not readable questions instead of failing the page', () => {
    const items = formsFaqItems([faq(), faq({ question: 'Not a question' }), faq({ answer: '  ' })]);
    expect(items).toHaveLength(1);
    expect(items[0]?.question).toBe('Is this a test question?');
  });
});
