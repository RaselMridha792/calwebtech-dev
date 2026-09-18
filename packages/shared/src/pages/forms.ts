import { z } from 'zod';
import { leadSubmissionSchema } from '../lead';
import { decorativeImageSchema, imageSchema } from '../media';
import { slugSchema } from '../seo';
import { siteLinkSchema } from '../site-chrome';
import { answerBlockSchema, faqItemSchema, pageSeoSchema, questionSchema, requiredText, timedStepSchema } from './common';

/**
 * The forms page family (docs/10-site-pages.md): `/start-a-project/` and
 * `/free-website-audit/`. Both are conversion pages with no record of their own, so their
 * copy lives in `Setting` rows keyed `forms.<page>` and the services a visitor can tick
 * come from published `Service` rows. The leads they create are ordinary leads: the API's
 * existing protections, storage and emails handle them (apps/api/src/leads).
 */

// ---------------------------------------------------------------- keys and constants

/** The family's routes. `SITE_ROUTES` belongs to the foundation, so the family names its own. */
export const FORMS_ROUTES = {
  startProject: '/start-a-project/',
  freeWebsiteAudit: '/free-website-audit/',
} as const;

/** Setting keys of the family, each validated by the content schema beside it. */
export const FORMS_SETTING_KEYS = {
  startProject: 'forms.start-a-project',
  freeWebsiteAudit: 'forms.free-website-audit',
} as const;

/** `Faq.group` of the questions shown on each page. */
export const FORMS_PROJECT_FAQ_GROUP = 'start-a-project';
export const FORMS_AUDIT_FAQ_GROUP = 'free-website-audit';

/** The `formId` of each form, so its leads are recognisable in the inbox. */
export const FORMS_PROJECT_FORM_ID = 'start-a-project';
export const FORMS_AUDIT_FORM_ID = 'free-website-audit';

/**
 * The brief's steps, in the order they are asked. Contact comes second on purpose: an email
 * address is the only thing that lets the API store an unfinished brief, so asking for it
 * early is what makes abandonment measurable per step (docs/06-build-plan.md, task 5.2).
 */
export const FORMS_PROJECT_STEPS = ['project-type', 'contact', 'services', 'budget', 'timeline', 'brief'] as const;
export type FormsProjectStep = (typeof FORMS_PROJECT_STEPS)[number];
export const formsProjectStepSchema = z.enum(FORMS_PROJECT_STEPS);

/** How far a visitor reached, 1 to 6, stored on the lead so each step's drop-off is countable. */
export const FORMS_PROJECT_STEP_COUNT = FORMS_PROJECT_STEPS.length;

// ---------------------------------------------------------------- building blocks

/** A form control's words: everything a visitor reads beside the input. */
const formsFieldSchema = z.object({
  label: requiredText(80),
  /** Guidance under the label, or null when the label says enough. */
  hint: z.string().trim().max(240).nullable(),
  /** Placeholder text, or null for controls that take none. */
  placeholder: z.string().trim().max(120).nullable(),
});
export type FormsField = z.output<typeof formsFieldSchema>;

const titledItemSchema = z.object({ title: requiredText(90), body: requiredText(600) });

const formsHeroSchema = z.object({
  eyebrow: requiredText(60),
  title: requiredText(80),
  answer: answerBlockSchema,
  intro: requiredText(400),
});

/** What the visitor is told on screen once the lead is stored; the confirmation email repeats it. */
const formsSuccessSchema = z.object({ heading: requiredText(120), body: requiredText(400) });

/** A question list's heading and introduction; the questions themselves are `Faq` rows. */
const formsFaqIntroSchema = z.object({ heading: questionSchema(120), intro: requiredText(300) });

// ---------------------------------------------------------------- /start-a-project/

const formsProjectStepCopySchema = z.object({
  key: formsProjectStepSchema,
  /** The step's own question, rendered as a `legend` inside the form, not as a page heading. */
  legend: questionSchema(120),
  hint: requiredText(300),
});

export const formsProjectFormSchema = z.object({
  heading: questionSchema(120),
  intro: requiredText(400),
  /** "Step", "of", so the progress line reads "Step 2 of 6" in the page's own words. */
  stepLabel: requiredText(30),
  ofLabel: requiredText(20),
  backLabel: requiredText(40),
  nextLabel: requiredText(40),
  submitLabel: requiredText(40),
  /** Shown once the API has stored the unfinished brief, e.g. "Saved. You can finish this later." */
  savedLabel: requiredText(120),
  /** Why the email is asked for on the second step. */
  saveNote: requiredText(400),
  /** Why there is no file upload yet and what to do instead (media storage is not built). */
  uploadNote: requiredText(500),
  footnote: requiredText(300),
  /** Shown in place of the service list while nothing is published. */
  servicesEmpty: requiredText(200),
  success: formsSuccessSchema,
  steps: z
    .array(formsProjectStepCopySchema)
    .length(FORMS_PROJECT_STEP_COUNT)
    .refine(
      (steps) => FORMS_PROJECT_STEPS.every((key, index) => steps[index]?.key === key),
      `The steps are written in order: ${FORMS_PROJECT_STEPS.join(', ')}`,
    ),
  fields: z.object({
    projectType: formsFieldSchema,
    name: formsFieldSchema,
    email: formsFieldSchema,
    company: formsFieldSchema,
    phone: formsFieldSchema,
    siteUrl: formsFieldSchema,
    serviceInterest: formsFieldSchema,
    budgetBand: formsFieldSchema,
    timeline: formsFieldSchema,
    description: formsFieldSchema,
    projectLinks: formsFieldSchema,
  }),
});

export const formsProjectContentSchema = z.object({
  seo: pageSeoSchema,
  hero: formsHeroSchema,
  backdrop: decorativeImageSchema.nullable(),
  assurances: z.array(requiredText(60)).min(1).max(4),
  form: formsProjectFormSchema,
  whatHappens: z.object({
    heading: questionSchema(120),
    intro: requiredText(400),
    steps: z.array(timedStepSchema).min(1).max(5),
  }),
  whatWeNeed: z.object({
    heading: questionSchema(120),
    intro: requiredText(400),
    items: z.array(requiredText(160)).min(1).max(8),
    note: requiredText(300),
  }),
  alternatives: z.object({
    heading: questionSchema(120),
    intro: requiredText(400),
    items: z.array(titledItemSchema.extend({ link: siteLinkSchema })).min(1).max(4),
  }),
  faq: formsFaqIntroSchema,
});

/** `GET /pages/start-a-project`. */
export const formsProjectViewSchema = z.object({
  content: formsProjectContentSchema,
  /** Published services, in order, for the "what do you need" step. Empty shows the empty state. */
  services: z.array(z.object({ slug: slugSchema, title: requiredText(80) })).max(16),
  /** Questions in the `start-a-project` group. */
  faqs: z.array(faqItemSchema),
});

// ---------------------------------------------------------------- /free-website-audit/

export const formsAuditFormSchema = z.object({
  heading: questionSchema(120),
  intro: requiredText(400),
  submitLabel: requiredText(40),
  footnote: requiredText(300),
  success: formsSuccessSchema,
  fields: z.object({
    siteUrl: formsFieldSchema,
    mainConcern: formsFieldSchema,
    competitorUrl: formsFieldSchema,
    name: formsFieldSchema,
    email: formsFieldSchema,
    company: formsFieldSchema,
    description: formsFieldSchema,
  }),
});

export const formsAuditContentSchema = z.object({
  seo: pageSeoSchema,
  hero: formsHeroSchema,
  backdrop: decorativeImageSchema.nullable(),
  assurances: z.array(requiredText(60)).min(1).max(4),
  covers: z.object({
    heading: questionSchema(120),
    intro: requiredText(400),
    items: z.array(titledItemSchema).min(1).max(8),
  }),
  delivery: z.object({
    heading: questionSchema(120),
    intro: requiredText(400),
    steps: z.array(timedStepSchema).min(1).max(4),
    image: imageSchema.nullable(),
  }),
  /** What the audit is not, so nobody expects a full strategy engagement. */
  limits: z.object({
    heading: questionSchema(120),
    intro: requiredText(400),
    items: z.array(requiredText(160)).min(1).max(6),
  }),
  form: formsAuditFormSchema,
  faq: formsFaqIntroSchema,
});

/** `GET /pages/free-website-audit`. */
export const formsAuditViewSchema = z.object({
  content: formsAuditContentSchema,
  /** Questions in the `free-website-audit` group. */
  faqs: z.array(faqItemSchema),
});

// ---------------------------------------------------------------- progressive saving

/**
 * `POST /forms/project-draft`, sent each time the brief moves on while a valid email is
 * known. It is the lead submission's own fields, so the draft can never accept something
 * the final submit would refuse, plus how far the visitor has reached.
 *
 * Turnstile runs on the final submit, not here: a token is single use, and the widget would
 * have to be reset on every step. The endpoint is rate limited, keeps the honeypot, and
 * writes at most one lead per brief.
 */
export const formsProjectDraftSchema = leadSubmissionSchema
  .pick({
    formId: true,
    name: true,
    email: true,
    company: true,
    phone: true,
    siteUrl: true,
    projectType: true,
    serviceInterest: true,
    budgetBand: true,
    timeline: true,
    message: true,
    projectLinks: true,
    attribution: true,
    referenceCode: true,
    draftId: true,
    draftToken: true,
  })
  .extend({
    /** 1 to 6: the step the visitor has reached, `FORMS_PROJECT_STEPS` by index. */
    step: z.number().int().min(1).max(FORMS_PROJECT_STEP_COUNT),
  });

export type FormsProjectDraftInput = z.input<typeof formsProjectDraftSchema>;
export type FormsProjectDraft = z.output<typeof formsProjectDraftSchema>;

/** What the API answers. `draft` is null when nothing was stored, so the page never claims it was. */
export const formsProjectDraftResultSchema = z.object({
  status: z.literal('saved'),
  draft: z
    .object({
      id: z.string().min(1).max(64),
      token: z.string().min(1).max(128),
      step: z.number().int().min(1).max(FORMS_PROJECT_STEP_COUNT),
    })
    .nullable(),
});
export type FormsProjectDraftResult = z.output<typeof formsProjectDraftResultSchema>;

// ---------------------------------------------------------------- types

export type FormsProjectContent = z.output<typeof formsProjectContentSchema>;
export type FormsProjectContentInput = z.input<typeof formsProjectContentSchema>;
export type FormsProjectView = z.output<typeof formsProjectViewSchema>;
export type FormsProjectForm = z.output<typeof formsProjectFormSchema>;
export type FormsAuditContent = z.output<typeof formsAuditContentSchema>;
export type FormsAuditContentInput = z.input<typeof formsAuditContentSchema>;
export type FormsAuditView = z.output<typeof formsAuditViewSchema>;
export type FormsAuditForm = z.output<typeof formsAuditFormSchema>;
