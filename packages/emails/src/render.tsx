import type { EmailJob, SiteContact } from '@calwebtech/shared';
import { render } from 'react-email';
import type { ReactElement } from 'react';
import { LeadConfirmationEmail, leadConfirmationSubject } from './lead-confirmation';
import { LeadNotificationEmail, leadNotificationSubject } from './lead-notification';

/** Data the worker loads at send time rather than carrying in the job. */
export interface EmailContext {
  contact: SiteContact | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function compose(job: EmailJob, context: EmailContext): { subject: string; element: ReactElement } {
  switch (job.template) {
    case 'lead-confirmation':
      return {
        subject: leadConfirmationSubject(job.lead),
        element: (
          <LeadConfirmationEmail lead={job.lead} acknowledgement={job.acknowledgement} contact={context.contact} />
        ),
      };
    case 'lead-notification':
      return {
        subject: leadNotificationSubject(job.lead),
        element: <LeadNotificationEmail lead={job.lead} />,
      };
  }
}

/** Renders a queued email job to a subject, HTML and a plain-text alternative. */
export async function renderEmail(job: EmailJob, context: EmailContext): Promise<RenderedEmail> {
  const { subject, element } = compose(job, context);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject, html, text };
}
