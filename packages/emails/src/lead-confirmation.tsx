import type { Acknowledgement, LeadSummary, SiteContact } from '@calwebtech/shared';
import { Heading, Link, Text } from 'react-email';
import { firstName, submissionRows } from './format';
import { DetailRows, EmailLayout, styles } from './layout';

export interface LeadConfirmationProps {
  lead: LeadSummary;
  acknowledgement: Acknowledgement;
  contact: SiteContact | null;
}

export function leadConfirmationSubject(lead: LeadSummary): string {
  return `We have your request, ${firstName(lead.name)}`;
}

/** Sent to the visitor. It repeats what the page told them, then what they sent. */
export function LeadConfirmationEmail({ lead, acknowledgement, contact }: LeadConfirmationProps) {
  return (
    <EmailLayout
      preview={acknowledgement.body}
      footer="You received this because you sent a request through the Calwebtech website."
    >
      <Heading as="h1" style={styles.heading}>
        {acknowledgement.heading}
      </Heading>
      <Text style={styles.paragraph}>Hi {firstName(lead.name)},</Text>
      <Text style={styles.paragraph}>{acknowledgement.body}</Text>

      <Text style={styles.label}>What you sent us</Text>
      <DetailRows rows={submissionRows(lead)} />
      {lead.message ? <Text style={styles.message}>{lead.message}</Text> : null}

      {contact?.phone && contact.phoneE164 ? (
        <Text style={styles.paragraph}>
          Need us sooner? Call{' '}
          <Link href={`tel:${contact.phoneE164}`} style={styles.link}>
            {contact.phone}
          </Link>{' '}
          or reply to this email.
        </Text>
      ) : (
        <Text style={styles.paragraph}>Need us sooner? Reply to this email.</Text>
      )}
    </EmailLayout>
  );
}
