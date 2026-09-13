import type { LeadSummary } from '@calwebtech/shared';
import { Heading, Hr, Text } from 'react-email';
import { attributionRows, firstName, oneLine, sourceLabel, submissionRows } from './format';
import { DetailRows, EmailLayout, styles } from './layout';

export function leadNotificationSubject(lead: LeadSummary): string {
  const who = lead.company ? `${lead.name} (${lead.company})` : lead.name;
  return oneLine(`New lead: ${who} via ${sourceLabel(lead)}`);
}

/** Sent to the team. Reply-To is the visitor, so answering the email reaches them. */
export function LeadNotificationEmail({ lead }: { lead: LeadSummary }) {
  const attribution = attributionRows(lead.attribution);
  return (
    <EmailLayout
      preview={`${oneLine(lead.name)} sent a request via ${sourceLabel(lead)}`}
      footer={`Lead ${lead.leadId}, form ${lead.formId}, submitted ${lead.submittedAt}.`}
    >
      <Heading as="h1" style={styles.heading}>
        New lead from {oneLine(lead.name)}
      </Heading>
      <Text style={styles.paragraph}>Reply to this email to answer {firstName(lead.name)} directly.</Text>
      <DetailRows rows={submissionRows(lead)} />

      {lead.message ? (
        <>
          <Text style={styles.label}>Message</Text>
          <Text style={styles.message}>{lead.message}</Text>
        </>
      ) : null}

      <Hr style={styles.rule} />
      <Text style={styles.label}>Where it came from</Text>
      {attribution.length > 0 ? (
        <DetailRows rows={attribution} />
      ) : (
        <Text style={styles.paragraph}>No attribution was captured.</Text>
      )}
    </EmailLayout>
  );
}
