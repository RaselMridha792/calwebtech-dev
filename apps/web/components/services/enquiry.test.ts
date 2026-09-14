import { SERVICE_ENQUIRY_FORM_ID, leadSubmissionSchema } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { leadSubmissionFromForm } from '@/lib/lead-form';

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
}

const base: [string, string][] = [
  ['type', 'SERVICE_ENQUIRY'],
  ['formId', SERVICE_ENQUIRY_FORM_ID],
  ['name', 'Test Person'],
  ['email', 'test@example.com'],
];

describe('the service enquiry form payload', () => {
  it('carries the service slug from the hidden field to the API', () => {
    const lead = leadSubmissionSchema.parse(leadSubmissionFromForm(form([...base, ['serviceSlug', 'website-redesign']]), null));
    expect(lead.type).toBe('SERVICE_ENQUIRY');
    expect(lead.formId).toBe('service-enquiry');
    expect(lead.serviceSlug).toBe('website-redesign');
  });

  it('leaves the slug out on forms without one, and rejects a tampered value', () => {
    expect(leadSubmissionSchema.parse(leadSubmissionFromForm(form(base), null)).serviceSlug).toBeUndefined();
    expect(leadSubmissionSchema.safeParse(leadSubmissionFromForm(form([...base, ['serviceSlug', 'Not A Slug']]), null)).success).toBe(false);
  });
});
