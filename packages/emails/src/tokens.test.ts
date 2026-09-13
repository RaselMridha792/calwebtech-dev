import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emailTokens, type EmailToken } from './tokens';

// Tests run from the package directory. import.meta is unavailable in a CommonJS package.
const theme = readFileSync(path.resolve(process.cwd(), '../config/tailwind/theme.css'), 'utf8');

function themeColour(name: EmailToken): string | undefined {
  return new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(theme)?.[1]?.toLowerCase();
}

describe('emailTokens', () => {
  it.each(Object.keys(emailTokens) as EmailToken[])('%s matches theme.css', (name) => {
    expect(themeColour(name)).toBe(emailTokens[name]);
  });
});
