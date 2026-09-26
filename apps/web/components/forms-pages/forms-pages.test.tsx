import {
  BUDGET_BANDS,
  FORMS_AUDIT_FORM_ID,
  FORMS_PROJECT_FORM_ID,
  FORMS_PROJECT_STEPS,
  LEAD_AUDIT_CONCERNS,
  LEAD_PROJECT_TYPES,
  START_TIMELINES,
  formsAuditViewSchema,
  formsProjectViewSchema,
} from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { formsAuditSnapshot, formsProjectSnapshot } from '@/static-content/forms';
import { AuditForm } from './audit-form';
import { AuditCovers, AuditDelivery, AuditFormSection, AuditLimits } from './audit-sections';
import { ProjectBriefForm } from './project-brief-form';
import { ProjectAlternatives, ProjectFormSection, ProjectWhatHappens, ProjectWhatWeNeed } from './project-sections';

// Both server actions reach the API, which cannot be imported outside a request. Only the
// actions are stubbed, so the form below is the one the page renders.
vi.mock('./actions', () => ({ saveProjectDraft: () => Promise.resolve({ status: 'saved', draft: null }) }));
vi.mock('@/lib/lead-actions', () => ({ submitLead: () => Promise.resolve({ status: 'idle' as const }) }));

const view = formsProjectViewSchema.parse(formsProjectSnapshot);
const { content } = view;
const render = (node: ReactNode) => renderToStaticMarkup(node);

const brief = () =>
  render(
    <ProjectBriefForm
      copy={content.form}
      projectTypes={LEAD_PROJECT_TYPES}
      budgets={BUDGET_BANDS}
      timelines={START_TIMELINES}
      services={view.services}
      formId={FORMS_PROJECT_FORM_ID}
      thankYouPath="/thank-you/project/"
      turnstileSiteKey={undefined}
    />,
  );

describe('the project brief', () => {
  it('asks its six questions in order, one at a time', () => {
    const html = brief();
    const legends = [...html.matchAll(/<legend[^>]*>([^<]+)<\/legend>/g)].map((match) => match[1]);
    expect(legends).toEqual(content.form.steps.map((step) => step.legend.replace(/'/g, '&#x27;')));
    expect(legends).toHaveLength(FORMS_PROJECT_STEPS.length);

    const fieldsets = [...html.matchAll(/<fieldset data-step="(\d)"( hidden="")?/g)];
    expect(fieldsets.map((match) => match[1])).toEqual(['0', '1', '2', '3', '4', '5']);
    expect(fieldsets.filter((match) => !match[2]).map((match) => match[1])).toEqual(['0']);
    expect(html).toContain(`${content.form.stepLabel} 1 ${content.form.ofLabel} 6`);
  });

  it('requires only a name and an email, each labelled', () => {
    const html = brief();
    const required = [...html.matchAll(/<input id="brief-(\w+)"[^>]*required=""/g)].map((match) => match[1]);
    expect(required).toEqual(['name', 'email']);
    expect(/<input id="brief-email"[^>]*>/.exec(html)?.[0]).toContain('type="email"');
    for (const field of ['name', 'email', 'company', 'phone', 'siteUrl', 'message', 'projectLinks']) {
      expect(html, `${field} is labelled`).toContain(`for="brief-${field}"`);
    }
  });

  it('offers the project types, the published services, the budgets and the timelines', () => {
    const html = brief();
    for (const option of LEAD_PROJECT_TYPES) expect(html).toContain(`name="projectType" value="${option.value}"`);
    for (const service of view.services) expect(html).toContain(`name="serviceInterest" value="${service.title}"`);
    for (const band of BUDGET_BANDS) expect(html).toContain(`name="budgetBand" value="${band.value}"`);
    for (const timeline of START_TIMELINES) expect(html).toContain(`name="timeline" value="${timeline.value}"`);
  });

  it('says so when no service is published rather than showing an empty list', () => {
    const html = render(
      <ProjectBriefForm
        copy={content.form}
        projectTypes={LEAD_PROJECT_TYPES}
        budgets={BUDGET_BANDS}
        timelines={START_TIMELINES}
        services={[]}
        formId={FORMS_PROJECT_FORM_ID}
        thankYouPath="/thank-you/project/"
        turnstileSiteKey={undefined}
      />,
    );
    expect(html).toContain(content.form.servicesEmpty);
    expect(html).not.toContain('name="serviceInterest"');
  });

  it('posts as a PROJECT lead of this form, with the draft fields and a honeypot a person never sees', () => {
    const html = brief();
    expect(html).toContain('noValidate=""');
    expect(html).toContain('name="type" value="PROJECT"');
    expect(html).toContain(`name="formId" value="${FORMS_PROJECT_FORM_ID}"`);
    expect(html).toContain('name="draftId"');
    expect(html).toContain('name="draftToken"');
    const honeypot = html.indexOf('name="referenceCode"');
    const wrapper = html.lastIndexOf('<div', honeypot);
    expect(html.slice(wrapper, honeypot)).toContain('aria-hidden="true"');
    expect(html.slice(honeypot - 200, honeypot + 200)).toContain('tabindex="-1"');
  });
});

describe('the start a project sections', () => {
  it('put the brief under its question-heading, with the assurances beside it', () => {
    const html = render(<ProjectFormSection content={content} form={<p>form</p>} />);
    expect(html).toContain('id="brief-heading"');
    expect(html).toContain(content.form.heading.replace(/'/g, '&#x27;'));
    for (const line of content.assurances) expect(html).toContain(line);
  });

  it('say what happens next, what a quote needs and where else to go', () => {
    const html = render(
      <>
        <ProjectWhatHappens content={content} />
        <ProjectWhatWeNeed content={content} />
        <ProjectAlternatives content={content} />
      </>,
    );
    for (const step of content.whatHappens.steps) expect(html).toContain(step.title);
    for (const item of content.whatWeNeed.items) expect(html).toContain(item.replace(/'/g, '&#x27;'));
    for (const item of content.alternatives.items) expect(html).toContain(`href="${item.link.href}"`);
    // Every section heading is a question a buyer types (CLAUDE.md, SEO rules).
    for (const heading of [content.whatHappens.heading, content.whatWeNeed.heading, content.alternatives.heading]) {
      expect(heading.endsWith('?')).toBe(true);
    }
  });
});

const audit = formsAuditViewSchema.parse(formsAuditSnapshot).content;

const auditForm = () =>
  render(
    <AuditForm
      copy={audit.form}
      concerns={LEAD_AUDIT_CONCERNS}
      formId={FORMS_AUDIT_FORM_ID}
      thankYouPath="/thank-you/audit/"
      turnstileSiteKey={undefined}
    />,
  );

describe('the free website audit request', () => {
  it('requires the site, a name and an email, each labelled', () => {
    const html = auditForm();
    const required = [...html.matchAll(/<input id="audit-(\w+)"[^>]*required=""/g)].map((match) => match[1]);
    expect(required).toEqual(['siteUrl', 'name', 'email']);
    expect(/<input id="audit-email"[^>]*>/.exec(html)?.[0]).toContain('type="email"');
    for (const field of ['siteUrl', 'competitorUrl', 'name', 'email', 'company', 'message']) {
      expect(html, `${field} is labelled`).toContain(`for="audit-${field}"`);
    }
  });

  it('asks the main concern as one answer from a labelled list', () => {
    const html = auditForm();
    expect(html).toContain(`<legend class="eyebrow text-ink-muted">${audit.form.fields.mainConcern.label}</legend>`);
    for (const concern of LEAD_AUDIT_CONCERNS) {
      expect(html).toMatch(new RegExp(`type="radio"[^>]*name="mainConcern" value="${concern.value}"`));
    }
  });

  it('keeps the fields of a row on one line, whatever their labels wrap to', () => {
    const html = auditForm();
    const field = html.slice(html.lastIndexOf('<div', html.indexOf('for="audit-competitorUrl"')));
    expect(field).toMatch(/^<div class="row-span-3 grid grid-rows-subgrid/);
  });

  it('posts as an AUDIT lead of this form, with a honeypot a person never sees', () => {
    const html = auditForm();
    expect(html).toContain('name="type" value="AUDIT"');
    expect(html).toContain(`name="formId" value="${FORMS_AUDIT_FORM_ID}"`);
    const honeypot = html.indexOf('name="referenceCode"');
    const wrapper = html.lastIndexOf('<div', honeypot);
    expect(html.slice(wrapper, honeypot)).toContain('aria-hidden="true"');
    expect(html.slice(honeypot - 200, honeypot + 200)).toContain('tabindex="-1"');
    expect(html).toContain(audit.form.submitLabel);
  });
});

describe('the free website audit sections', () => {
  it('put the request under its question-heading, with the assurances beside it', () => {
    const html = render(<AuditFormSection content={audit} form={<p>form</p>} />);
    expect(html).toContain('id="audit-request"');
    expect(html).toContain('id="audit-request-heading"');
    for (const line of audit.assurances) expect(html).toContain(line.replace(/'/g, '&#x27;'));
  });

  it('say what the audit covers, how it arrives and what it is not', () => {
    const html = render(
      <>
        <AuditCovers content={audit} />
        <AuditDelivery content={audit} />
        <AuditLimits content={audit} />
      </>,
    );
    for (const item of audit.covers.items) expect(html).toContain(item.title.replace(/'/g, '&#x27;'));
    for (const step of audit.delivery.steps) expect(html).toContain(step.title.replace(/'/g, '&#x27;'));
    for (const item of audit.limits.items) expect(html).toContain(item.replace(/'/g, '&#x27;'));
    // The covers are rows on hairlines, never cards (the brand's second rule).
    expect(html).not.toMatch(/<li[^>]*\bborder\s/);
    for (const heading of [audit.covers.heading, audit.delivery.heading, audit.limits.heading, audit.form.heading]) {
      expect(heading.endsWith('?')).toBe(true);
    }
  });

  it('leave the picture out when the delivery has none', () => {
    const html = render(<AuditDelivery content={{ ...audit, delivery: { ...audit.delivery, image: null } }} />);
    expect(html).not.toContain('<img');
    for (const step of audit.delivery.steps) expect(html).toContain(step.title.replace(/'/g, '&#x27;'));
  });
});
