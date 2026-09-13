/**
 * Brand colours for email. Mail clients ignore CSS variables and most stylesheets, so
 * templates need literal values. They mirror packages/config/tailwind/theme.css, and
 * tokens.test.ts fails when the two drift apart.
 *
 * `result` (teal) is deliberately absent: an email has no outcome figures to mark.
 */
export const emailTokens = {
  ink: '#0a1d37',
  primary: '#1550e0',
  mist: '#eef3f9',
  mist2: '#f7fafd',
  line: '#dce4ee',
  body: '#41536b',
  white: '#ffffff',
} as const;

export type EmailToken = keyof typeof emailTokens;

/** Web fonts rarely load in mail clients, so the brand faces fall back to system sans. */
export const emailFonts = {
  display: "'Plus Jakarta Sans', Arial, Helvetica, sans-serif",
  body: "'IBM Plex Sans', Arial, Helvetica, sans-serif",
} as const;
