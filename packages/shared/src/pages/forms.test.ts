import { describe, expect, it } from 'vitest';
import { LEAD_AUDIT_CONCERNS, LEAD_PROJECT_TYPES, leadSubmissionSchema } from '../lead';
import {
  FORMS_PROJECT_STEPS,
  FORMS_PROJECT_STEP_COUNT,
  FORMS_ROUTES,
  FORMS_SETTING_KEYS,
  formsProjectDraftResultSchema,
  formsProjectDraftSchema,
  formsProjectFormSchema,
} from './forms';

const field = { label: 'Work email', hint: null, placeholder: 'you@company.com' };

const fields = {
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
};

const steps = FORMS_PROJECT_STEPS.map((key) => ({
  key,
  legend: 'What kind of project is this?',
  hint: 'Pick the closest description; we can change it later.',
}));

function projectForm(overrides: Record<string, unknown> = {}) {
  return {
    heading: 'What happens when you send this brief?',
    intro: 'Six short steps. Nothing here is binding, and you can change any answer before you send it.',
    stepLabel: 'Step',
    ofLabel: 'of',
    backLabel: 'Back',
    nextLabel: 'Next step',
    submitLabel: 'Send the brief',
    savedLabel: 'Saved. You can close this and finish it later.',
    saveNote: 'We ask for your email on the second step so your answers are saved against your brief.',
    uploadNote: 'Attachments are not stored yet, so paste a link to anything you want us to read.',
    footnote: 'We reply to every brief, and we never pass your details to anyone else.',
    servicesEmpty: 'The service list is not published yet, so describe what you need in your own words.',
    success: { heading: 'Your brief is with us.', body: 'A developer reads it and replies by email.' },
    steps,
    fields,
    ...overrides,
  };
}

describe('forms family constants', () => {
  it('routes are lowercase, hyphenated and end in a slash', () => {
    for (const path of Object.values(FORMS_ROUTES)) expect(path).toMatch(/^\/[a-z0-9-]+\/$/);
  });

  it('keys both pages under the family prefix', () => {
    for (const key of Object.values(FORMS_SETTING_KEYS)) expect(key).toMatch(/^forms\./);
    expect(new Set(Object.values(FORMS_SETTING_KEYS)).size).toBe(2);
  });

  it('asks for contact second, so an unfinished brief can be stored from step two on', () => {
    expect(FORMS_PROJECT_STEPS[1]).toBe('contact');
    expect(FORMS_PROJECT_STEP_COUNT).toBe(6);
    expect(new Set(FORMS_PROJECT_STEPS).size).toBe(FORMS_PROJECT_STEP_COUNT);
  });

  it('offers stable segmentation values for project types and audit concerns', () => {
    for (const option of [...LEAD_PROJECT_TYPES, ...LEAD_AUDIT_CONCERNS]) {
      expect(option.value).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});

describe('formsProjectFormSchema', () => {
  it('accepts the six steps written in order', () => {
    expect(formsProjectFormSchema.parse(projectForm()).steps.map((step) => step.key)).toEqual([...FORMS_PROJECT_STEPS]);
  });

  it('refuses steps in another order, so the copy cannot drift from the form', () => {
    const reordered = [steps[1], steps[0], ...steps.slice(2)];
    expect(formsProjectFormSchema.safeParse(projectForm({ steps: reordered })).success).toBe(false);
  });

  it('refuses a step legend that is not a question', () => {
    const plain = steps.map((step, index) => (index === 0 ? { ...step, legend: 'Project type' } : step));
    expect(formsProjectFormSchema.safeParse(projectForm({ steps: plain })).success).toBe(false);
  });
});

describe('formsProjectDraftSchema', () => {
  const draft = {
    formId: 'start-a-project',
    step: 2,
    name: 'Dana Whitfield',
    email: 'Dana@Example.com ',
    serviceInterest: [],
  };

  it('normalises the same way the lead submission does, so a draft can always be completed', () => {
    const parsed = formsProjectDraftSchema.parse({ ...draft, siteUrl: 'example.com', company: '  ' });
    expect(parsed.email).toBe('dana@example.com');
    expect(parsed.siteUrl).toBe('https://example.com');
    expect(parsed.company).toBeUndefined();
    expect(parsed.attribution).toEqual({});
  });

  it('needs an email, because nothing can be stored without one', () => {
    expect(formsProjectDraftSchema.safeParse({ ...draft, email: 'not-an-address' }).success).toBe(false);
  });

  it('keeps the step inside the range of the form', () => {
    expect(formsProjectDraftSchema.safeParse({ ...draft, step: 0 }).success).toBe(false);
    expect(formsProjectDraftSchema.safeParse({ ...draft, step: FORMS_PROJECT_STEP_COUNT + 1 }).success).toBe(false);
  });

  it('carries the honeypot and the draft handle', () => {
    const parsed = formsProjectDraftSchema.parse({
      ...draft,
      referenceCode: 'filled by a bot',
      draftId: 'lead-1',
      draftToken: 'token-1',
    });
    expect(parsed.referenceCode).toBe('filled by a bot');
    expect(parsed.draftId).toBe('lead-1');
  });
});

describe('leadSubmissionSchema with the forms family fields', () => {
  const submission = {
    type: 'PROJECT',
    formId: 'start-a-project',
    name: 'Dana Whitfield',
    email: 'dana@example.com',
  };

  it('accepts the brief and audit fields, and leaves them out when they are blank', () => {
    const parsed = leadSubmissionSchema.parse({
      ...submission,
      projectType: 'redesign',
      projectLinks: 'https://example.com/brief.pdf',
      mainConcern: 'slow-on-mobile',
      competitorUrl: 'competitor.com',
    });
    expect(parsed.projectType).toBe('redesign');
    expect(parsed.competitorUrl).toBe('https://competitor.com');

    const blank = leadSubmissionSchema.parse({ ...submission, projectType: '', mainConcern: '', competitorUrl: '' });
    expect(blank.projectType).toBeUndefined();
    expect(blank.mainConcern).toBeUndefined();
    expect(blank.competitorUrl).toBeUndefined();
  });

  it('refuses a project type or concern it does not know', () => {
    expect(leadSubmissionSchema.safeParse({ ...submission, projectType: 'something-else' }).success).toBe(false);
    expect(leadSubmissionSchema.safeParse({ ...submission, mainConcern: 'something-else' }).success).toBe(false);
  });
});

describe('formsProjectDraftResultSchema', () => {
  it('allows a saved draft and nothing stored', () => {
    expect(formsProjectDraftResultSchema.parse({ status: 'saved', draft: null }).draft).toBeNull();
    expect(
      formsProjectDraftResultSchema.parse({ status: 'saved', draft: { id: 'lead-1', token: 'token-1', step: 3 } }).draft
        ?.step,
    ).toBe(3);
  });
});
