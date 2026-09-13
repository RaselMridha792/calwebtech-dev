/**
 * Cloudflare's documented Turnstile test keys
 * (developers.cloudflare.com/turnstile/troubleshooting/testing). The test sitekeys produce
 * the dummy token, and the test secrets accept only the dummy token. Test code only.
 */
export const TURNSTILE_TEST = {
  alwaysPassesSecret: '1x0000000000000000000000000000000AA',
  alwaysFailsSecret: '2x0000000000000000000000000000000AA',
  dummyToken: 'XXXX.DUMMY.TOKEN.XXXX',
} as const;
