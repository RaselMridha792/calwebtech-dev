import {
  BUDGET_BANDS,
  START_TIMELINES,
  type Attribution,
  type LeadSummary,
  type Utm,
} from '@calwebtech/shared';

export type DetailRow = readonly [label: string, value: string];

/** Header-safe single line: names and companies arrive from a public form. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function firstName(name: string): string {
  return oneLine(name).split(' ')[0] ?? name;
}

export function budgetLabel(value: string): string {
  return BUDGET_BANDS.find((band) => band.value === value)?.label ?? value;
}

export function timelineLabel(value: string): string {
  return START_TIMELINES.find((item) => item.value === value)?.label ?? value;
}

/** Where the form was submitted, e.g. "/lp/b2b-website-design/". */
export function sourceLabel(lead: LeadSummary): string {
  return lead.landingPageSlug ? `/lp/${lead.landingPageSlug}/` : `form ${lead.formId}`;
}

/** What the visitor sent, skipping empty fields. The free-text message is shown apart. */
export function submissionRows(lead: LeadSummary): DetailRow[] {
  const rows: (DetailRow | null)[] = [
    ['Name', lead.name],
    ['Email', lead.email],
    lead.enquiry ? ['Enquiry', lead.enquiry] : null,
    lead.company ? ['Company', lead.company] : null,
    lead.phone ? ['Phone', lead.phone] : null,
    lead.siteUrl ? ['Website', lead.siteUrl] : null,
    lead.serviceInterest.length > 0 ? ['Services', lead.serviceInterest.join(', ')] : null,
    lead.budgetBand ? ['Budget', budgetLabel(lead.budgetBand)] : null,
    lead.timeline ? ['Start', timelineLabel(lead.timeline)] : null,
  ];
  return rows.filter((row) => row !== null);
}

function utmText(utm: Utm | undefined): string | null {
  const parts = [utm?.source, utm?.medium, utm?.campaign].filter((part) => part !== undefined && part !== '');
  return parts.length > 0 ? parts.join(' / ') : null;
}

/** Where the lead came from, for the internal notification. */
export function attributionRows(attribution: Attribution): DetailRow[] {
  const firstTouch = utmText(attribution.firstTouch);
  const lastTouch = utmText(attribution.lastTouch);
  const rows: (DetailRow | null)[] = [
    attribution.landingPage ? ['Landing page', attribution.landingPage] : null,
    firstTouch ? ['First touch', firstTouch] : null,
    lastTouch ? ['Last touch', lastTouch] : null,
    attribution.referrer ? ['Referrer', attribution.referrer] : null,
    attribution.device ? ['Device', attribution.device] : null,
  ];
  return rows.filter((row) => row !== null);
}
