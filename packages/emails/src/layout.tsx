import { Body, Column, Container, Head, Html, Preview, Row, Section, Text } from 'react-email';
import type { CSSProperties, ReactNode } from 'react';
import type { DetailRow } from './format';
import { emailFonts, emailTokens } from './tokens';

export const styles = {
  heading: {
    margin: '0 0 16px',
    fontFamily: emailFonts.display,
    fontSize: '22px',
    lineHeight: '28px',
    fontWeight: 800,
    color: emailTokens.ink,
  },
  paragraph: { margin: '0 0 14px', fontSize: '15px', lineHeight: '23px', color: emailTokens.body },
  label: {
    margin: '20px 0 6px',
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: emailTokens.ink,
  },
  rowLabel: { width: '120px', padding: '6px 12px 6px 0', fontSize: '14px', color: emailTokens.body, verticalAlign: 'top' },
  rowValue: { padding: '6px 0', fontSize: '14px', color: emailTokens.ink, verticalAlign: 'top' },
  message: {
    margin: '0 0 14px',
    padding: '12px 14px',
    backgroundColor: emailTokens.mist,
    borderRadius: '8px',
    fontSize: '14px',
    lineHeight: '21px',
    color: emailTokens.ink,
    whiteSpace: 'pre-wrap',
  },
  link: { color: emailTokens.primary, textDecoration: 'underline' },
  rule: { margin: '24px 0 8px', borderColor: emailTokens.line },
} satisfies Record<string, CSSProperties>;

export function EmailLayout({
  preview,
  footer,
  children,
}: {
  preview: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, backgroundColor: emailTokens.mist2, fontFamily: emailFonts.body }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 20px' }}>
          <Text
            style={{
              margin: '0 0 20px',
              fontFamily: emailFonts.display,
              fontSize: '18px',
              fontWeight: 800,
              color: emailTokens.ink,
            }}
          >
            Calwebtech
          </Text>
          <Section
            style={{
              backgroundColor: emailTokens.white,
              border: `1px solid ${emailTokens.line}`,
              borderRadius: '12px',
              padding: '28px',
            }}
          >
            {children}
          </Section>
          <Text style={{ margin: '20px 0 0', fontSize: '12px', lineHeight: '18px', color: emailTokens.body }}>
            {footer}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function DetailRows({ rows }: { rows: readonly DetailRow[] }) {
  return (
    <Section style={{ margin: '4px 0 12px' }}>
      {rows.map(([label, value]) => (
        <Row key={label}>
          <Column style={styles.rowLabel}>{label}</Column>
          <Column style={styles.rowValue}>{value}</Column>
        </Row>
      ))}
    </Section>
  );
}
