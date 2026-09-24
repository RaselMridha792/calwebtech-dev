import { Resend } from 'resend';

export interface OutgoingEmail {
  from: string;
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  /** Resend keeps it for 24 hours, so a retried send returns the first email instead of a second. */
  idempotencyKey: string;
  /** Extra headers, such as `List-Unsubscribe` on a campaign email. */
  headers?: Record<string, string>;
}

/** Resend is a sending transport only. Nothing about who receives what lives there. */
export interface EmailTransport {
  readonly name: string;
  send(email: OutgoingEmail): Promise<{ id: string }>;
}

export function resendTransport(apiKey: string): EmailTransport {
  const resend = new Resend(apiKey);
  return {
    name: 'resend',
    async send({ idempotencyKey, replyTo, headers, ...email }) {
      const { data, error } = await resend.emails.send(
        { ...email, ...(replyTo ? { replyTo } : {}), ...(headers ? { headers } : {}) },
        { idempotencyKey },
      );
      if (error) throw new Error(`Resend rejected the email: ${error.name}: ${error.message}`);
      return { id: data.id };
    },
  };
}

/** Renders and logs, sends nothing. CI never has a Resend key, so it cannot send real mail. */
export function logTransport(log: (line: string) => void): EmailTransport {
  return {
    name: 'log',
    send(email) {
      log(`email not sent (EMAIL_TRANSPORT=log): "${email.subject}" to ${email.to.join(', ')}`);
      return Promise.resolve({ id: `log-${email.idempotencyKey}` });
    },
  };
}
