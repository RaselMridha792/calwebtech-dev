'use server';

import { redirect } from 'next/navigation';
import { apiUrl, hasApi } from '@/lib/api/core';

/**
 * The unsubscribe button. The API does the work and owns every rule; this only forwards the
 * token and comes back to the page, which then reads "done". The token is re-read from the
 * form, never trusted as anything but a path segment.
 */
export async function unsubscribe(form: FormData): Promise<void> {
  const token = form.get('token');
  if (typeof token !== 'string' || token.length === 0 || token.length > 200) redirect('/');
  if (hasApi()) {
    await fetch(apiUrl(`/unsubscribe/${encodeURIComponent(token)}`), { method: 'POST', cache: 'no-store' });
  }
  redirect(`/unsubscribe/${encodeURIComponent(token)}/`);
}
