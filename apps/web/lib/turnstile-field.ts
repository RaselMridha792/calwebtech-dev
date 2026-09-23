/**
 * The hidden input Cloudflare writes its token into, and the key every server action reads
 * it back out of.
 *
 * It lives here, on its own, rather than beside the hook that renders the widget: the hook
 * is a `'use client'` module, and a constant imported from one of those into a server
 * action is not a string on the server but a reference to the client module. `form.get()`
 * then matches nothing, the token arrives empty, and the visitor is told their own booking
 * looked automated.
 */
export const TURNSTILE_FIELD = 'cf-turnstile-response';
