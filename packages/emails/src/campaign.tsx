import { personalise, type CampaignBlock, type CampaignContent, type CampaignRecipient } from '@calwebtech/shared';
import { Button, Heading, Hr, Link, Section, Text, render } from 'react-email';
import { EmailLayout, styles } from './layout';
import { emailFonts, emailTokens } from './tokens';

/**
 * Campaign emails (Task 5.4). Two branded templates render the same block body:
 *
 * - `letter`: a plain note, every block in the card as it is written.
 * - `announcement`: the first heading is lifted out of the card onto a dark band.
 *
 * Tokens are filled here, per recipient, so the API's preview, the worker's test send and
 * the real send all personalise with the one function in the shared package.
 */

export interface CampaignEmailProps {
  content: CampaignContent;
  recipient: CampaignRecipient;
  /**
   * The recipient's own unsubscribe link. Null for a preview or a test, where there is
   * nobody to unsubscribe; the footer then says where the link will be.
   */
  unsubscribeUrl: string | null;
}

const blockStyles = {
  button: {
    display: 'inline-block',
    margin: '6px 0 18px',
    padding: '12px 20px',
    backgroundColor: emailTokens.primary,
    borderRadius: '6px',
    color: emailTokens.white,
    fontSize: '15px',
    fontWeight: 700,
    textDecoration: 'none',
  },
  band: {
    margin: '0 0 20px',
    padding: '28px',
    backgroundColor: emailTokens.ink,
    borderRadius: '12px',
  },
  bandHeading: {
    margin: 0,
    fontFamily: emailFonts.display,
    fontSize: '28px',
    lineHeight: '34px',
    fontWeight: 800,
    color: emailTokens.white,
  },
} as const;

function Block({ block, recipient }: { block: CampaignBlock; recipient: CampaignRecipient }) {
  switch (block.type) {
    case 'heading':
      return (
        <Heading as="h2" style={styles.heading}>
          {personalise(block.text, recipient)}
        </Heading>
      );
    case 'paragraph':
      return <Text style={{ ...styles.paragraph, whiteSpace: 'pre-wrap' }}>{personalise(block.text, recipient)}</Text>;
    case 'button':
      return (
        <Button href={block.url} style={blockStyles.button}>
          {personalise(block.label, recipient)}
        </Button>
      );
    case 'divider':
      return <Hr style={styles.rule} />;
  }
}

function Footer({ unsubscribeUrl }: { unsubscribeUrl: string | null }) {
  return (
    <>
      You receive this because you subscribed to updates from Calwebtech.{' '}
      {unsubscribeUrl ? (
        <Link href={unsubscribeUrl} style={styles.link}>
          Unsubscribe
        </Link>
      ) : (
        'Each recipient gets their own unsubscribe link here.'
      )}
    </>
  );
}

export function CampaignEmail({ content, recipient, unsubscribeUrl }: CampaignEmailProps) {
  const blocks = content.body.blocks;
  const lead = content.templateKey === 'announcement' ? blocks.find((block) => block.type === 'heading') : undefined;
  const rest = lead ? blocks.filter((block) => block !== lead) : blocks;
  const preview = personalise(content.preheader ?? content.subject, recipient);

  return (
    <EmailLayout preview={preview} footer={<Footer unsubscribeUrl={unsubscribeUrl} />}>
      {lead?.type === 'heading' ? (
        <Section style={blockStyles.band}>
          <Heading as="h1" style={blockStyles.bandHeading}>
            {personalise(lead.text, recipient)}
          </Heading>
        </Section>
      ) : null}
      {rest.map((block, index) => (
        <Block key={index} block={block} recipient={recipient} />
      ))}
    </EmailLayout>
  );
}

export function campaignSubject(content: CampaignContent, recipient: CampaignRecipient): string {
  return personalise(content.subject, recipient);
}

export interface RenderedCampaign {
  subject: string;
  preheader: string | null;
  html: string;
  text: string;
}

/** A campaign for one recipient: subject, preview text, HTML and the plain-text part. */
export async function renderCampaign(props: CampaignEmailProps): Promise<RenderedCampaign> {
  const element = <CampaignEmail {...props} />;
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return {
    subject: campaignSubject(props.content, props.recipient),
    preheader: props.content.preheader ? personalise(props.content.preheader, props.recipient) : null,
    html,
    text,
  };
}
