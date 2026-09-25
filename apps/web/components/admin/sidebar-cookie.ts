/**
 * The cookie that remembers the sidebar narrowed to a rail. In its own module, with no
 * directive, because the layout reads it on the server: a constant imported from a
 * `'use client'` file arrives there as a client reference, not as the string
 * (docs/08-decisions.md, 47).
 */
export const SIDEBAR_COOKIE = 'admin-sidebar';
