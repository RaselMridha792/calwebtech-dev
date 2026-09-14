import type { CalculatorResultEmail, LeadSummary } from '@calwebtech/shared';
import { Button, Heading, Hr, Section, Text } from 'react-email';
import type { CSSProperties } from 'react';
import { firstName } from './format';
import { DetailRows, EmailLayout, styles } from './layout';
import { emailFonts, emailTokens } from './tokens';

/** Styles this template adds to the shared ones. Teal stays out: an email has no outcome figures. */
const local = {
  range: {
    margin: '0 0 6px',
    fontFamily: emailFonts.display,
    fontSize: '26px',
    lineHeight: '32px',
    fontWeight: 800,
    color: emailTokens.ink,
  },
  button: {
    display: 'inline-block',
    padding: '14px 22px',
    borderRadius: '10px',
    backgroundColor: emailTokens.primary,
    fontSize: '15px',
    fontWeight: 600,
    color: emailTokens.white,
    textDecoration: 'none',
  },
  footnote: { margin: '14px 0 0', fontSize: '13px', lineHeight: '19px', color: emailTokens.body },
} satisfies Record<string, CSSProperties>;

export interface CalculatorResultProps {
  lead: LeadSummary;
  result: CalculatorResultEmail;
  /** The site's public origin, for the links. Without it the email carries none. */
  siteOrigin: string | null;
}

export function calculatorResultSubject(result: CalculatorResultEmail): string {
  return `${result.heading}: ${result.rangeLabel}`;
}

/** A site path made absolute, or null when the worker has no origin configured. */
function absolute(path: string, origin: string | null): string | null {
  if (!origin) return null;
  const url = URL.parse(path, origin);
  return url ? url.toString() : null;
}

/**
 * The visitor's copy of their cost estimate. Every figure and every word comes from the
 * job, which the API built from the estimate it stored and the page's own copy, so this
 * email repeats exactly what the visitor saw and promises nothing extra.
 */
export function CalculatorResultEmailTemplate({ lead, result, siteOrigin }: CalculatorResultProps) {
  const booking = absolute(result.bookingPath, siteOrigin);
  const methodology = absolute(result.methodologyPath, siteOrigin);
  return (
    <EmailLayout
      preview={`${result.rangeHeading}: ${result.rangeLabel}`}
      footer="You received this because you asked for a cost estimate on the Calwebtech website."
    >
      <Heading as="h1" style={styles.heading}>
        {result.heading}
      </Heading>
      <Text style={styles.paragraph}>Hi {firstName(lead.name)},</Text>
      <Text style={styles.paragraph}>{result.intro}</Text>

      <Text style={styles.label}>{result.rangeHeading}</Text>
      <Text style={local.range}>{result.rangeLabel}</Text>
      <Text style={styles.paragraph}>
        <b>{result.tierName}</b>
        {`. ${result.tierSummary}`}
      </Text>

      <Text style={styles.label}>{result.monthlyHeading}</Text>
      <Text style={styles.paragraph}>{result.monthly}</Text>

      <Text style={styles.label}>{result.breakdownHeading}</Text>
      <DetailRows rows={result.breakdown.map((row) => [row.label, row.detail ? `${row.detail} — ${row.value}` : row.value])} />

      <Text style={styles.label}>{result.moversHeading}</Text>
      {result.movers.length > 0 ? (
        <DetailRows rows={result.movers.map((row) => [row.label, row.value])} />
      ) : (
        <Text style={styles.paragraph}>{result.noMovers}</Text>
      )}

      {booking ? (
        <Section style={{ margin: '24px 0 8px' }}>
          <Button href={booking} style={local.button}>
            {result.bookingLabel}
          </Button>
        </Section>
      ) : null}

      <Hr style={styles.rule} />
      <Text style={styles.label}>{result.answersHeading}</Text>
      <DetailRows rows={result.answers.map((row) => [row.label, row.value])} />

      <Text style={local.footnote}>{result.note}</Text>
      {methodology ? (
        <Text style={local.footnote}>
          <a href={methodology} style={styles.link}>
            {result.methodologyLabel}
          </a>
        </Text>
      ) : null}
    </EmailLayout>
  );
}
